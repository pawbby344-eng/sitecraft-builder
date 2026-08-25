import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { blockPropsByType } from "../../../shared/site-engine/schemas";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { moveEditorSection, type EditorBlock as SharedEditorBlock } from "../../../shared/site-engine/editor";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Circle,
  FileText,
  Image as ImageIcon,
  Layers3,
  LayoutTemplate,
  Loader2,
  MousePointer2,
  PanelRight,
  Save,
  Sparkles,
  SquareStack,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BlockType = "section" | "text" | "image" | "button";
type EditorBlock = SharedEditorBlock;
type WorkspaceProject = {
  id: number;
  name: string;
  projectSlug: string;
  projectDraftRevision: number;
  isPublished: boolean;
  updatedAt: Date | string;
};
type ArchitectState = {
  project: { id: number; name: string; projectSlug: string; projectDraftRevision: number; theme: unknown };
  pages: Array<{ id: number; name: string; pageSlug: string; purpose: string; isHome: boolean }>;
  blocks: EditorBlock[];
};

const typeMeta: Record<BlockType, { label: string; icon: typeof Type; accent: string }> = {
  section: { label: "Section", icon: SquareStack, accent: "text-amber-700 bg-amber-50 border-amber-200" },
  text: { label: "Text", icon: Type, accent: "text-blue-700 bg-blue-50 border-blue-200" },
  image: { label: "Image", icon: ImageIcon, accent: "text-violet-700 bg-violet-50 border-violet-200" },
  button: { label: "Button", icon: MousePointer2, accent: "text-emerald-700 bg-emerald-50 border-emerald-200" },
};

function textValue(props: Record<string, unknown>, key: string, fallback = "") {
  const value = props[key];
  return typeof value === "string" ? value : fallback;
}

function selectValue(props: Record<string, unknown>, key: string, fallback: string) {
  const value = props[key];
  return typeof value === "string" ? value : fallback;
}

function safeProps(block: EditorBlock) {
  try {
    return blockPropsByType[block.type].parse(block.props) as Record<string, unknown>;
  } catch {
    return block.props;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

export default function Workspace() {
  const projectsQuery = trpc.workspace.projects.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
  const [draftBlocks, setDraftBlocks] = useState<EditorBlock[]>([]);
  const [originalBlocks, setOriginalBlocks] = useState<EditorBlock[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  const projects = (projectsQuery.data ?? []) as WorkspaceProject[];
  useEffect(() => {
    if (selectedProjectId === null && projects[0]) setSelectedProjectId(projects[0].id);
    if (selectedProjectId !== null && !projects.some((project) => project.id === selectedProjectId)) setSelectedProjectId(projects[0]?.id ?? null);
  }, [projects, selectedProjectId]);

  const stateInput = useMemo(() => ({ projectId: selectedProjectId ?? 0 }), [selectedProjectId]);
  const stateQuery = trpc.architect.state.useQuery(stateInput, { enabled: selectedProjectId !== null });
  const state = stateQuery.data as ArchitectState | undefined;
  const pages = state?.pages ?? [];

  useEffect(() => {
    if (pages.length && (selectedPageId === null || !pages.some((page) => page.id === selectedPageId))) {
      setSelectedPageId(pages[0].id);
    }
    if (!pages.length) setSelectedPageId(null);
  }, [pages, selectedPageId]);

  useEffect(() => {
    if (!state || selectedPageId === null || dirty) return;
    const nextBlocks = state.blocks.filter((block) => block.pageId === selectedPageId).sort((a, b) => a.sortOrder - b.sortOrder);
    setDraftBlocks(nextBlocks);
    setOriginalBlocks(nextBlocks);
    setSelectedBlockId(null);
    setSaveState("idle");
  }, [state, selectedPageId, dirty]);

  const selectedBlock = draftBlocks.find((block) => block.id === selectedBlockId) ?? null;
  const sections = draftBlocks.filter((block) => block.type === "section").sort((a, b) => a.sortOrder - b.sortOrder);
  const contentFor = (sectionId: number) => draftBlocks.filter((block) => block.parentBlockId === sectionId).sort((a, b) => a.sortOrder - b.sortOrder);

  const updateBlock = (blockId: number, patch: Record<string, unknown>) => {
    setDraftBlocks((current) => current.map((block) => block.id === blockId ? { ...block, props: { ...block.props, ...patch } } : block));
    setDirty(true);
    setSaveState("idle");
    setSaveMessage("");
  };

  const updateMutation = trpc.siteBlocks.update.useMutation();
  const reorderMutation = trpc.siteBlocks.reorder.useMutation();
  const replaceAllMutation = trpc.siteBlocks.replaceAll.useMutation();
  const isSaving = updateMutation.isPending || reorderMutation.isPending || replaceAllMutation.isPending;
  const save = async () => {
    if (!state || selectedPageId === null || !dirty || isSaving) return;
    try {
      draftBlocks.forEach((block) => blockPropsByType[block.type].parse(block.props));
      const originalById = new Map(originalBlocks.map((block) => [block.id, block]));
      const changedProps = draftBlocks.filter((block) => JSON.stringify(block.props) !== JSON.stringify(originalById.get(block.id)?.props));
      const changedOrder = draftBlocks.some((block) => {
        const original = originalById.get(block.id);
        return original && (block.sortOrder !== original.sortOrder || block.parentBlockId !== original.parentBlockId);
      });
      setSaveState("saving");
      setSaveMessage("");
      if (changedProps.length === 1 && !changedOrder) {
        const block = changedProps[0]!;
        await updateMutation.mutateAsync({ projectId: state.project.id, pageId: selectedPageId, expectedRevision: state.project.projectDraftRevision, blockId: block.id, parentBlockId: block.parentBlockId, type: block.type, sortOrder: block.sortOrder, props: block.props });
      } else if (changedProps.length === 0 && changedOrder) {
        await reorderMutation.mutateAsync({ projectId: state.project.id, pageId: selectedPageId, expectedRevision: state.project.projectDraftRevision, blocks: draftBlocks });
      } else {
        await replaceAllMutation.mutateAsync({ projectId: state.project.id, pageId: selectedPageId, expectedRevision: state.project.projectDraftRevision, blocks: draftBlocks });
      }
      await Promise.all([stateQuery.refetch(), projectsQuery.refetch()]);
      setDirty(false);
      setSaveState("saved");
      setSaveMessage("Draft saved");
    } catch (error) {
      setSaveState("error");
      const message = error instanceof Error ? error.message : "";
      setSaveMessage(message.includes("CONFLICT") || message.includes("stale") ? "Draft changed elsewhere. Reload before saving." : "Could not save this draft.");
    }
  };

  const moveSection = (sectionId: number, direction: -1 | 1) => {
    setDraftBlocks((current) => moveEditorSection(current, sectionId, direction));
    setDirty(true);
  };

  if (projectsQuery.isLoading) return <LoadingWorkspace />;
  if (projectsQuery.isError) return <WorkspaceError message="Could not load your workspace." onRetry={() => projectsQuery.refetch()} />;
  if (!projects.length) return <EmptyWorkspace />;

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f7f8fa] shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
      <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm"><Layers3 className="h-5 w-5" /></div>
          <div>
            <div className="flex items-center gap-2"><span className="text-sm font-semibold tracking-tight text-slate-950">SiteCraft</span><Badge variant="secondary" className="rounded-full bg-slate-100 px-2 py-0 text-[10px] uppercase tracking-[0.14em] text-slate-500">Workspace</Badge></div>
            <p className="mt-0.5 text-xs text-slate-400">Shape the draft. Keep the signal.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><span className={cn("h-2 w-2 rounded-full", dirty ? "bg-amber-400" : "bg-emerald-500")} />{dirty ? "Unsaved changes" : "All changes saved"}</div>
          <Button onClick={save} disabled={!dirty || isSaving} className="h-10 rounded-xl bg-slate-950 px-4 text-sm text-white shadow-sm hover:bg-slate-800">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save draft
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[236px_minmax(0,1fr)_280px]">
        <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
          <div className="mb-6 flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Projects</span><span className="text-xs text-slate-400">{projects.length}</span></div>
          <div className="space-y-1.5">
            {projects.map((project) => (
              <button key={project.id} onClick={() => { setSelectedProjectId(project.id); setDirty(false); }} className={cn("group w-full rounded-xl border px-3 py-3 text-left transition", selectedProjectId === project.id ? "border-slate-300 bg-slate-950 text-white shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-slate-50")}>
                <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", selectedProjectId === project.id ? "bg-emerald-400" : "bg-slate-300")} /><span className="truncate text-sm font-medium">{project.name}</span></div>
                <div className={cn("mt-1 truncate pl-4 text-[11px]", selectedProjectId === project.id ? "text-slate-400" : "text-slate-400")}>/{project.projectSlug}</div>
              </button>
            ))}
          </div>
          <div className="mt-8 border-t border-slate-100 pt-5"><div className="mb-3 flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-slate-400" /><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pages</span></div>
            <div className="space-y-1">
              {pages.map((page) => <button key={page.id} onClick={() => { setSelectedPageId(page.id); setSelectedBlockId(null); setDirty(false); }} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition", selectedPageId === page.id ? "bg-slate-100 font-semibold text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}><span className="flex min-w-0 items-center gap-2"><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{page.name}</span></span>{page.isHome ? <span className="text-[10px] uppercase tracking-widest text-slate-400">Home</span> : <ChevronRight className="h-3 w-3 text-slate-300" />}</button>)}
            </div>
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-[#f7f8fa] p-5 lg:p-8">
          <div className="mx-auto max-w-[860px]">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Visual editor</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{state?.project.name ?? "Loading project"}</h1><p className="mt-1 text-sm text-slate-500">{pages.find((page) => page.id === selectedPageId)?.name ?? "Select a page"} · Draft revision {state?.project.projectDraftRevision ?? "—"}</p></div><div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500"><Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" /> Private workspace</div></div>
            {stateQuery.isLoading ? <CanvasSkeleton /> : stateQuery.isError ? <WorkspaceError message="Could not load this project." onRetry={() => stateQuery.refetch()} /> : <div className="space-y-4">
              {sections.map((section, sectionIndex) => {
                const sectionProps = safeProps(section);
                const selected = section.id === selectedBlockId;
                return <section key={section.id} onClick={() => setSelectedBlockId(section.id)} className={cn("group relative rounded-2xl border-2 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] transition", selected ? "border-slate-950" : "border-transparent hover:border-slate-300")} style={{ background: textValue(sectionProps, "backgroundOverride", "#ffffff") }}>
                  <div className="absolute -top-3 left-4 flex items-center gap-1 opacity-0 transition group-hover:opacity-100"><span className="rounded-md bg-slate-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">Section</span><button aria-label="Move section up" onClick={(event) => { event.stopPropagation(); moveSection(section.id, -1); }} className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-slate-950"><ArrowUp className="h-3 w-3" /></button><button aria-label="Move section down" onClick={(event) => { event.stopPropagation(); moveSection(section.id, 1); }} className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-slate-950"><ArrowDown className="h-3 w-3" /></button></div>
                  <div className={cn("mb-4 flex items-center justify-between border-b border-dashed border-slate-200 pb-3", selected && "border-slate-300")}><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{selectValue(sectionProps, "layout", "stack")} layout</p><p className="mt-1 text-xs text-slate-400">{selectValue(sectionProps, "align", "left")} aligned content</p></div><span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] text-slate-400">{contentFor(section.id).length} blocks</span></div>
                  <div className="space-y-3">{contentFor(section.id).map((block) => <CanvasBlock key={block.id} block={block} selected={block.id === selectedBlockId} onSelect={() => setSelectedBlockId(block.id)} />)}</div>
                </section>;
              })}
              {!sections.length && <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center"><SquareStack className="mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-medium text-slate-700">This page has no sections yet</p><p className="mt-1 max-w-xs text-xs text-slate-400">Stage 4 edits existing Draft content. New structure is created by the Stage 3 Build flow.</p></div>}
            </div>}
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-5">
          <div className="mb-6 flex items-center justify-between"><div className="flex items-center gap-2"><PanelRight className="h-4 w-4 text-slate-400" /><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Properties</span></div>{selectedBlock ? <Badge className={cn("rounded-full border px-2 py-0 text-[10px]", typeMeta[selectedBlock.type].accent)}>{typeMeta[selectedBlock.type].label}</Badge> : null}</div>
          {selectedBlock ? <PropertiesPanel block={selectedBlock} onChange={(patch) => updateBlock(selectedBlock.id, patch)} /> : <div className="flex min-h-[280px] flex-col items-center justify-center text-center"><MousePointer2 className="mb-3 h-7 w-7 text-slate-300" /><p className="text-sm font-medium text-slate-700">Select a block</p><p className="mt-1 text-xs leading-5 text-slate-400">Choose a Section, Text, Image or Button in the canvas to edit its properties.</p></div>}
          {saveState !== "idle" && <div className={cn("mt-8 rounded-xl border p-3 text-xs", saveState === "error" ? "border-red-200 bg-red-50 text-red-700" : saveState === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}><div className="flex items-start gap-2">{saveState === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : saveState === "saved" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />}<span>{saveMessage || "Saving draft…"}</span></div></div>}
          <div className="mt-8 rounded-xl bg-slate-950 p-4 text-white"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-300" /><span className="text-xs font-semibold">Editor guardrails</span></div><p className="mt-2 text-xs leading-5 text-slate-400">Changes stay inside the current Draft. AI Local Edit and publishing are intentionally not available in this stage.</p></div>
        </aside>
      </div>
    </div>
  );
}

function CanvasBlock({ block, selected, onSelect }: { block: EditorBlock; selected: boolean; onSelect: () => void }) {
  const props = safeProps(block);
  const meta = typeMeta[block.type];
  const Icon = meta.icon;
  return <button onClick={(event) => { event.stopPropagation(); onSelect(); }} className={cn("flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left transition", selected ? "border-slate-950 shadow-[0_0_0_3px_rgba(15,23,42,0.08)]" : "border-slate-200 hover:border-slate-400 hover:shadow-sm")}><span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", meta.accent)}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1">{block.type === "text" && <><span className="block text-sm font-semibold text-slate-950">{textValue(props, "content", "Untitled text")}</span><span className="mt-1 block text-[11px] text-slate-400">{selectValue(props, "variant", "body")} · {selectValue(props, "align", "left")}</span></>}{block.type === "image" && <><span className="block truncate text-sm font-semibold text-slate-950">{textValue(props, "alt", "Image")}</span><span className="mt-1 block truncate text-[11px] text-slate-400">{textValue(props, "src", "No source")}</span></>}{block.type === "button" && <><span className="block text-sm font-semibold text-slate-950">{textValue(props, "label", "Button")}</span><span className="mt-1 block text-[11px] text-slate-400">{textValue(props, "href", "#")} · {selectValue(props, "variant", "primary")}</span></>}{block.type === "section" && <span className="block text-sm font-semibold text-slate-950">Section container</span>}</span><ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300" /></button>;
}

function PropertiesPanel({ block, onChange }: { block: EditorBlock; onChange: (patch: Record<string, unknown>) => void }) {
  const props = safeProps(block);
  if (block.type === "section") return <div className="space-y-5"><Field label="Layout"><SelectField value={selectValue(props, "layout", "stack")} onChange={(value) => onChange({ layout: value })} options={["stack", "split", "centered"]} /></Field><Field label="Alignment"><SelectField value={selectValue(props, "align", "left")} onChange={(value) => onChange({ align: value })} options={["left", "center", "right"]} /></Field><Field label="Background token"><Input value={textValue(props, "backgroundToken", "background")} onChange={(event) => onChange({ backgroundToken: event.target.value })} /></Field><Field label="Spacing token"><Input value={textValue(props, "spacingToken", "section")} onChange={(event) => onChange({ spacingToken: event.target.value })} /></Field><Field label="Content width token"><Input value={textValue(props, "contentWidthToken", "wide")} onChange={(event) => onChange({ contentWidthToken: event.target.value })} /></Field><Field label="Background override"><Input value={textValue(props, "backgroundOverride", "")} placeholder="#ffffff" onChange={(event) => onChange({ backgroundOverride: event.target.value || undefined })} /></Field><div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">Tokens stay controlled by the project theme. Overrides remain optional and strict.</div></div>;
  if (block.type === "text") return <div className="space-y-5"><Field label="Content"><Textarea value={textValue(props, "content")} rows={6} onChange={(event) => onChange({ content: event.target.value })} /></Field><Field label="Variant"><SelectField value={selectValue(props, "variant", "body")} onChange={(value) => onChange({ variant: value })} options={["heading", "body", "eyebrow"]} /></Field><Field label="Alignment"><SelectField value={selectValue(props, "align", "left")} onChange={(value) => onChange({ align: value })} options={["left", "center", "right"]} /></Field><Field label="Typography token"><Input value={textValue(props, "typographyToken", "body")} onChange={(event) => onChange({ typographyToken: event.target.value || undefined })} /></Field><Field label="Color override"><Input value={textValue(props, "colorOverride", "")} placeholder="#111827" onChange={(event) => onChange({ colorOverride: event.target.value || undefined })} /></Field></div>;
  if (block.type === "image") return <div className="space-y-5"><Field label="Image URL"><Input value={textValue(props, "src")} onChange={(event) => onChange({ src: event.target.value })} /></Field><Field label="Alt text"><Input value={textValue(props, "alt")} onChange={(event) => onChange({ alt: event.target.value })} /></Field><Field label="Fit"><SelectField value={selectValue(props, "fit", "cover")} onChange={(value) => onChange({ fit: value })} options={["cover", "contain"]} /></Field><Field label="Radius token"><Input value={textValue(props, "radiusToken", "medium")} onChange={(event) => onChange({ radiusToken: event.target.value })} /></Field><div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"><img src={textValue(props, "src")} alt={textValue(props, "alt")} className="h-28 w-full object-cover" /></div></div>;
  return <div className="space-y-5"><Field label="Label"><Input value={textValue(props, "label")} onChange={(event) => onChange({ label: event.target.value })} /></Field><Field label="Link"><Input value={textValue(props, "href")} onChange={(event) => onChange({ href: event.target.value })} /></Field><Field label="Variant"><SelectField value={selectValue(props, "variant", "primary")} onChange={(value) => onChange({ variant: value })} options={["primary", "secondary", "ghost"]} /></Field><Field label="Alignment"><SelectField value={selectValue(props, "align", "left")} onChange={(value) => onChange({ align: value })} options={["left", "center", "right"]} /></Field></div>;
}

function LoadingWorkspace() { return <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>; }
function CanvasSkeleton() { return <div className="space-y-4"><div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" /><div className="h-56 animate-pulse rounded-2xl bg-slate-200/70" /></div>; }
function WorkspaceError({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-center"><AlertCircle className="mb-3 h-7 w-7 text-red-400" /><p className="text-sm font-medium text-red-800">{message}</p><Button onClick={onRetry} variant="outline" className="mt-4 rounded-lg border-red-200 bg-white">Retry</Button></div>; }
function EmptyWorkspace() { return <div className="flex min-h-[calc(100vh-2rem)] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center"><Layers3 className="mb-4 h-10 w-10 text-slate-300" /><h1 className="text-xl font-semibold tracking-tight text-slate-950">Your workspace is ready</h1><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">No projects exist for this private workspace yet. Create a project through the approved IDEA → Brief → SiteSpec → Build flow, then return here to edit its Draft.</p></div>; }
