import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { blockPropsByType } from "../../../shared/site-engine/schemas";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { moveEditorSection, type EditorBlock as SharedEditorBlock } from "../../../shared/site-engine/editor";
import { renderSiteHtml } from "../../../shared/site-engine/renderer";
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
  Monitor,
  Tablet,
  Smartphone,
  Globe2,
  Lock,
  Unlock,
  SquareStack,
  Type,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/useMobile";

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
type MobilePane = "projects" | "editor" | "properties";

type ArchitectState = {
  project: { id: number; name: string; projectSlug: string; projectDraftRevision: number; theme: unknown; isPublished?: boolean; publishedRevisionId?: number | null };
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
      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
  const [aiScopeType, setAiScopeType] = useState<"block" | "section" | "page" | "theme">("block");
  const [aiInstruction, setAiInstruction] = useState("");
  const [activeProposal, setActiveProposal] = useState<{ id: number; proposal: { summary: string; changes: Array<{ kind: string; blockId?: number; props: unknown }> } } | null>(null);
  const [aiMessage, setAiMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [publishMessage, setPublishMessage] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("editor");
  const isMobile = useIsMobile();

  const projects = (projectsQuery.data ?? []) as WorkspaceProject[];
  useEffect(() => {
    if (selectedProjectId === null && projects[0]) setSelectedProjectId(projects[0].id);
    if (selectedProjectId !== null && !projects.some((project) => project.id === selectedProjectId)) setSelectedProjectId(projects[0]?.id ?? null);
  }, [projects, selectedProjectId]);

  const stateInput = useMemo(() => ({ projectId: selectedProjectId ?? 0 }), [selectedProjectId]);
  const stateQuery = trpc.architect.state.useQuery(stateInput, { enabled: selectedProjectId !== null });
  const aiStateQuery = trpc.aiEdit.state.useQuery(stateInput, { enabled: selectedProjectId !== null });
  const publishStatusQuery = trpc.publish.status.useQuery(stateInput, { enabled: selectedProjectId !== null });
  const state = stateQuery.data as ArchitectState | undefined;
  const pages = state?.pages ?? [];

  useEffect(() => {
    if (pages.length && (selectedPageId === null || !pages.some((page) => page.id === selectedPageId))) {
      setSelectedPageId(pages[0].id);
    }
    if (!pages.length) setSelectedPageId(null);
  }, [pages, selectedPageId]);

  useEffect(() => {
    if (!state || selectedPageId === null) {
      if (!dirty) {
        setDraftBlocks([]);
        setOriginalBlocks([]);
        setSelectedBlockId(null);
      }
      return;
    }
    if (dirty) return;
    const nextBlocks = state.blocks.filter((block) => block.pageId === selectedPageId).sort((a, b) => a.sortOrder - b.sortOrder);
    setDraftBlocks(nextBlocks);
    setOriginalBlocks(nextBlocks);
    setSelectedBlockId(null);
    setSaveState("idle");
  }, [state, selectedPageId, dirty]);

  const selectedBlock = draftBlocks.find((block) => block.id === selectedBlockId) ?? null;
  const selectBlock = (blockId: number) => {
    setSelectedBlockId(blockId);
    if (isMobile) setMobilePane("properties");
  };
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
  const proposalMutation = trpc.aiEdit.createProposal.useMutation();
  const applyProposalMutation = trpc.aiEdit.applyProposal.useMutation();
  const rejectProposalMutation = trpc.aiEdit.rejectProposal.useMutation();
  const lockMutation = trpc.aiEdit.setLock.useMutation();
  const publishMutation = trpc.publish.publish.useMutation();
  const unpublishMutation = trpc.publish.unpublish.useMutation();
  const aiBusy = proposalMutation.isPending || applyProposalMutation.isPending || rejectProposalMutation.isPending;
  const effectiveScopeId = aiScopeType === "theme" ? null : aiScopeType === "page" ? selectedPageId : selectedBlockId;
  const lockAvailable = aiScopeType !== "page";
  const previewSnapshot = useMemo(() => state && pages.length > 0 ? { schemaVersion: "1" as const, project: { id: state.project.id, name: state.project.name, projectSlug: state.project.projectSlug }, theme: state.project.theme, pages: pages.map((page) => ({ id: page.id, name: page.name, pageSlug: page.pageSlug, purpose: page.purpose ?? null, isHome: page.isHome, blocks: state.blocks.filter((block) => block.pageId === page.id).map((block) => ({ id: block.id, pageId: block.pageId, parentBlockId: block.parentBlockId, type: block.type, sortOrder: block.sortOrder, props: block.props })) })) } : null, [state, pages]);
  const previewPageSlug = pages.find((page) => page.id === selectedPageId)?.pageSlug;
  const previewSrcDoc = previewSnapshot ? renderSiteHtml(previewSnapshot, previewPageSlug) : "";
  const previewWidth = previewViewport === "desktop" ? "100%" : previewViewport === "tablet" ? "768px" : "390px";
  const activeLock = (aiStateQuery.data?.locks ?? []).find((lock) => lock.scopeType === aiScopeType && (lock.scopeId ?? null) === (effectiveScopeId ?? null) && lock.locked);

  const askAI = async () => {
    if (!state || effectiveScopeId === undefined || effectiveScopeId === null && aiScopeType !== "theme" || !aiInstruction.trim() || aiBusy) return;
    setAiMessage("");
    try {
      const result = await proposalMutation.mutateAsync({ projectId: state.project.id, scopeType: aiScopeType, scopeId: effectiveScopeId, instruction: aiInstruction.trim() });
      setActiveProposal({ id: result.proposalId, proposal: result.proposal });
      setAiMessage("Proposal ready for review");
      await aiStateQuery.refetch();
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : "Could not create proposal");
    }
  };

  const rejectAI = async () => {
    if (!state || !activeProposal) return;
    try { await rejectProposalMutation.mutateAsync({ projectId: state.project.id, proposalId: activeProposal.id }); setActiveProposal(null); setAiMessage("Proposal rejected"); await aiStateQuery.refetch(); } catch (error) { setAiMessage(error instanceof Error ? error.message : "Could not reject proposal"); }
  };

  const applyAI = async () => {
    if (!state || !activeProposal || dirty) { setAiMessage(dirty ? "Save the Draft before applying a proposal" : "No proposal selected"); return; }
    try { await applyProposalMutation.mutateAsync({ projectId: state.project.id, proposalId: activeProposal.id, expectedRevision: state.project.projectDraftRevision }); setActiveProposal(null); setAiMessage("Proposal applied"); await Promise.all([stateQuery.refetch(), projectsQuery.refetch(), aiStateQuery.refetch()]); } catch (error) { setAiMessage(error instanceof Error ? error.message : "Could not apply proposal"); }
  };

  const publishDraft = async () => {
    if (!state || dirty || publishMutation.isPending) { setPublishMessage(dirty ? "Save the Draft before publishing" : "No project selected"); return; }
    try { await publishMutation.mutateAsync({ projectId: state.project.id, expectedRevision: state.project.projectDraftRevision }); setPublishMessage("Published revision updated"); await Promise.all([publishStatusQuery.refetch(), stateQuery.refetch(), projectsQuery.refetch()]); } catch (error) { setPublishMessage(error instanceof Error ? error.message : "Could not publish this Draft"); }
  };

  const unpublishDraft = async () => {
    if (!state || unpublishMutation.isPending) return;
    try {
      const latestStatus = await publishStatusQuery.refetch();
      const expectedPublishedRevisionId = latestStatus.data?.publishedRevisionId;
      if (!expectedPublishedRevisionId) return;
      await unpublishMutation.mutateAsync({ projectId: state.project.id, expectedPublishedRevisionId });
      setPublishMessage("Public site unpublished");
      await publishStatusQuery.refetch();
    } catch (error) { setPublishMessage(error instanceof Error ? error.message : "Could not unpublish this site"); }
  };

  const toggleLock = async () => {
    if (!state || !lockAvailable || effectiveScopeId === undefined || effectiveScopeId === null && aiScopeType !== "theme") return;
    try { await lockMutation.mutateAsync({ projectId: state.project.id, scopeType: aiScopeType as "block" | "section" | "theme", scopeId: aiScopeType === "theme" ? null : effectiveScopeId, locked: !activeLock }); await aiStateQuery.refetch(); setAiMessage(activeLock ? "Scope unlocked" : "Scope locked"); } catch (error) { setAiMessage(error instanceof Error ? error.message : "Could not update lock"); }
  };
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
  if (!projects.length) return <EmptyWorkspace onBuilt={(projectId) => { projectsQuery.refetch().then(() => setSelectedProjectId(projectId)); }} />;
  if (builderOpen) return <ProjectBuilder onBuilt={(projectId) => { setBuilderOpen(false); projectsQuery.refetch().then(() => setSelectedProjectId(projectId)); }} />;

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f7f8fa] shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
      <header className="flex min-h-[76px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm"><Layers3 className="h-5 w-5" /></div>
          <div>
            <div className="flex items-center gap-2"><span className="text-sm font-semibold tracking-tight text-slate-950">SiteCraft</span><Badge variant="secondary" className="rounded-full bg-slate-100 px-2 py-0 text-[10px] uppercase tracking-[0.14em] text-slate-500">Workspace</Badge></div>
            <p className="mt-0.5 text-xs text-slate-400">Shape the draft. Keep the signal.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><span className={cn("h-2 w-2 rounded-full", dirty ? "bg-amber-400" : "bg-emerald-500")} />{dirty ? "Unsaved changes" : "All changes saved"}</div>
          <div className="hidden items-center gap-2 md:flex"><Button onClick={() => setPreviewOpen((value) => !value)} variant="outline" className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm text-slate-700">{previewOpen ? <PanelRight className="mr-2 h-4 w-4" /> : <Monitor className="mr-2 h-4 w-4" />}{previewOpen ? "Editor" : "Preview"}</Button>{publishStatusQuery.data?.isPublished ? <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">Published</Badge> : <Badge variant="secondary" className="rounded-full">Draft only</Badge>}</div><Button onClick={() => setPreviewOpen((value) => !value)} variant="outline" className="h-11 w-11 min-w-11 rounded-xl border-slate-200 bg-white px-0 text-sm text-slate-700 md:hidden" aria-label={previewOpen ? "Open editor" : "Open preview"}>{previewOpen ? <PanelRight className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}</Button><Button onClick={save} disabled={!dirty || isSaving} className="h-10 rounded-xl bg-slate-950 px-4 text-sm text-white shadow-sm hover:bg-slate-800">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save draft
          </Button>
        </div>
      </header>

      <nav aria-label="Workspace sections" className="sticky top-0 z-20 grid grid-cols-3 gap-1 border-b border-slate-200 bg-white p-2 md:hidden">
        {([['projects', 'Projects'], ['editor', 'Editor'], ['properties', 'Properties']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setMobilePane(value)} className={cn("min-h-11 rounded-lg px-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition", mobilePane === value ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")} aria-current={mobilePane === value ? "page" : undefined} data-testid={`mobile-pane-${value}`}>{label}</button>)}
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)_280px]">
        <aside data-testid="mobile-workspace-projects" className={cn("min-h-0 overflow-y-auto border-b border-slate-200 bg-white p-4 md:block md:border-b-0 md:border-r", isMobile && mobilePane !== "projects" && "hidden")}>
          <div className="mb-6 flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Projects</span><div className="flex items-center gap-2"><span className="text-xs text-slate-400">{projects.length}</span><button aria-label="Create new project" onClick={() => setBuilderOpen(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"><Plus className="h-3.5 w-3.5" /></button></div></div>
          <div className="space-y-1.5">
            {projects.map((project) => (
              <button key={project.id} onClick={() => { setSelectedProjectId(project.id); setDirty(false); setMobilePane("editor"); }} className={cn("group w-full rounded-xl border px-3 py-3 text-left transition", selectedProjectId === project.id ? "border-slate-300 bg-slate-950 text-white shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-slate-50")}>
                <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", selectedProjectId === project.id ? "bg-emerald-400" : "bg-slate-300")} /><span className="truncate text-sm font-medium">{project.name}</span></div>
                <div className={cn("mt-1 truncate pl-4 text-[11px]", selectedProjectId === project.id ? "text-slate-400" : "text-slate-400")}>/{project.projectSlug}</div>
              </button>
            ))}
          </div>
          <div className="mt-8 border-t border-slate-100 pt-5"><div className="mb-3 flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-slate-400" /><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pages</span></div>
            <div className="space-y-1">
              {pages.map((page) => <button key={page.id} onClick={() => { setSelectedPageId(page.id); setSelectedBlockId(null); setDirty(false); setMobilePane("editor"); }} className={cn("flex min-h-10 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition", selectedPageId === page.id ? "bg-slate-100 font-semibold text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}><span className="flex min-w-0 items-center gap-2"><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{page.name}</span></span>{page.isHome ? <span className="text-[10px] uppercase tracking-widest text-slate-400">Home</span> : <ChevronRight className="h-3 w-3 text-slate-300" />}</button>)}
            </div>
          </div>
        </aside>

        <main data-testid="mobile-workspace-editor" className={cn("min-h-0 overflow-y-auto bg-[#f7f8fa] p-3 sm:p-5 lg:p-8 md:block", isMobile && mobilePane !== "editor" && "hidden")}>
          <div className="mx-auto max-w-[860px]">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Visual editor</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{state?.project.name ?? "Loading project"}</h1><p className="mt-1 text-sm text-slate-500">{pages.find((page) => page.id === selectedPageId)?.name ?? "Select a page"} · Draft revision {state?.project.projectDraftRevision ?? "—"}</p></div><div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500"><Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" /> Private workspace</div></div>
            {previewOpen ? <PreviewPanel viewport={previewViewport} setViewport={setPreviewViewport} srcDoc={previewSrcDoc} /> : stateQuery.isLoading ? <CanvasSkeleton /> : stateQuery.isError ? <WorkspaceError message="Could not load this project." onRetry={() => stateQuery.refetch()} /> : <div className="space-y-4">
              {sections.map((section, sectionIndex) => {
                const sectionProps = safeProps(section);
                const selected = section.id === selectedBlockId;
                return <section key={section.id} onClick={() => selectBlock(section.id)} className={cn("group relative rounded-2xl border-2 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] transition", selected ? "border-slate-950" : "border-transparent hover:border-slate-300")} style={{ background: textValue(sectionProps, "backgroundOverride", "#ffffff") }}>
                  <div className="absolute -top-3 left-4 flex items-center gap-1 opacity-0 transition group-hover:opacity-100"><span className="rounded-md bg-slate-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">Section</span><button aria-label="Move section up" onClick={(event) => { event.stopPropagation(); moveSection(section.id, -1); }} className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-slate-950"><ArrowUp className="h-3 w-3" /></button><button aria-label="Move section down" onClick={(event) => { event.stopPropagation(); moveSection(section.id, 1); }} className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-slate-950"><ArrowDown className="h-3 w-3" /></button></div>
                  <div className={cn("mb-4 flex items-center justify-between border-b border-dashed border-slate-200 pb-3", selected && "border-slate-300")}><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{selectValue(sectionProps, "layout", "stack")} layout</p><p className="mt-1 text-xs text-slate-400">{selectValue(sectionProps, "align", "left")} aligned content</p></div><span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] text-slate-400">{contentFor(section.id).length} blocks</span></div>
                  <div className="space-y-3">{contentFor(section.id).map((block) => <CanvasBlock key={block.id} block={block} selected={block.id === selectedBlockId} onSelect={() => selectBlock(block.id)} />)}</div>
                </section>;
              })}
              {!sections.length && <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center"><SquareStack className="mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-medium text-slate-700">This page has no sections yet</p><p className="mt-1 max-w-xs text-xs text-slate-400">Stage 4 edits existing Draft content. New structure is created by the Stage 3 Build flow.</p></div>}
            </div>}
          </div>
        </main>

        <aside data-testid="mobile-workspace-properties" className={cn("min-h-0 overflow-y-auto border-t border-slate-200 bg-white p-4 sm:p-5 md:block md:border-l md:border-t-0", isMobile && mobilePane !== "properties" && "hidden")}>
          <div className="mb-6 flex items-center justify-between"><div className="flex items-center gap-2"><PanelRight className="h-4 w-4 text-slate-400" /><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Properties</span></div>{selectedBlock ? <Badge className={cn("rounded-full border px-2 py-0 text-[10px]", typeMeta[selectedBlock.type].accent)}>{typeMeta[selectedBlock.type].label}</Badge> : null}</div>
          {selectedBlock ? <PropertiesPanel block={selectedBlock} onChange={(patch) => updateBlock(selectedBlock.id, patch)} /> : <div className="flex min-h-[280px] flex-col items-center justify-center text-center"><MousePointer2 className="mb-3 h-7 w-7 text-slate-300" /><p className="text-sm font-medium text-slate-700">Select a block</p><p className="mt-1 text-xs leading-5 text-slate-400">Choose a Section, Text, Image or Button in the canvas to edit its properties.</p></div>}
          {saveState !== "idle" && <div className={cn("mt-8 rounded-xl border p-3 text-xs", saveState === "error" ? "border-red-200 bg-red-50 text-red-700" : saveState === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}><div className="flex items-start gap-2">{saveState === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : saveState === "saved" ? <Check className="mt-0.5 h-4 w-4" /> : <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />}<span>{saveMessage || "Saving draft…"}</span></div></div>}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /><span className="text-xs font-semibold text-slate-900">AI Local Edit</span></div><p className="mt-1 text-[11px] leading-4 text-slate-400">Proposal only. Draft changes after Apply.</p></div><Badge variant="secondary" className="rounded-full text-[10px]">{aiStateQuery.data?.proposals?.filter((item) => item.status === "pending").length ?? 0} pending</Badge></div><div className="mt-4 space-y-3"><Field label="Scope"><SelectField value={aiScopeType} onChange={(value) => setAiScopeType(value as typeof aiScopeType)} options={["block", "section", "page", "theme"]} /></Field><Field label="Command"><Textarea value={aiInstruction} rows={3} placeholder="Make the headline more direct" onChange={(event) => setAiInstruction(event.target.value)} /></Field><div className="flex gap-2"><Button onClick={askAI} disabled={aiBusy || !aiInstruction.trim() || effectiveScopeId === null && aiScopeType !== "theme"} className="h-9 flex-1 rounded-lg bg-slate-950 text-xs text-white hover:bg-slate-800">{proposalMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}Ask AI</Button><Button onClick={toggleLock} disabled={!lockAvailable || lockMutation.isPending || effectiveScopeId === null && aiScopeType !== "theme"} variant="outline" className="h-9 rounded-lg px-3 text-xs">{activeLock ? <Unlock className="mr-1.5 h-3.5 w-3.5" /> : <Lock className="mr-1.5 h-3.5 w-3.5" />}{activeLock ? "Unlock" : "Lock"}</Button></div>{activeProposal && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-950">{activeProposal.proposal.summary}</p><p className="mt-1 text-[11px] text-amber-800">{activeProposal.proposal.changes.length} validated change{activeProposal.proposal.changes.length === 1 ? "" : "s"}. Review before applying.</p><div className="mt-3 space-y-2">{activeProposal.proposal.changes.map((change, index) => { const before = change.kind === "theme" ? state?.project.theme : draftBlocks.find((block) => block.id === change.blockId)?.props; return <div key={`${change.kind}-${change.blockId ?? index}`} className="grid gap-2 text-[10px] sm:grid-cols-2"><div className="rounded-lg border border-amber-200 bg-white/70 p-2"><span className="font-semibold uppercase tracking-wider text-slate-400">Before</span><pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-slate-600">{JSON.stringify(before, null, 2)}</pre></div><div className="rounded-lg border border-amber-300 bg-amber-100/50 p-2"><span className="font-semibold uppercase tracking-wider text-amber-700">After</span><pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-amber-950">{JSON.stringify(change.props, null, 2)}</pre></div></div>; })}</div><div className="mt-3 flex gap-2"><Button onClick={applyAI} disabled={aiBusy || dirty} className="h-8 flex-1 rounded-lg bg-amber-500 text-xs text-white hover:bg-amber-600">{applyProposalMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Apply</Button><Button onClick={rejectAI} disabled={aiBusy} variant="outline" className="h-8 rounded-lg bg-white text-xs">Reject</Button></div></div>}{aiMessage && <p className="text-[11px] leading-4 text-slate-500">{aiMessage}</p>}</div></div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-slate-500" /><span className="text-xs font-semibold text-slate-900">Publish</span></div><p className="mt-1 text-[11px] leading-4 text-slate-400">Public site reads only the latest immutable revision.</p><div className="mt-3 flex gap-2"><Button onClick={publishDraft} disabled={dirty || publishMutation.isPending} className="h-9 flex-1 rounded-lg bg-slate-950 text-xs text-white hover:bg-slate-800">{publishMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}{publishStatusQuery.data?.isPublished ? "Re-publish" : "Publish"}</Button>{publishStatusQuery.data?.isPublished && <Button onClick={unpublishDraft} disabled={unpublishMutation.isPending || publishStatusQuery.isFetching} variant="outline" className="h-9 rounded-lg px-3 text-xs">Unpublish</Button>}</div>{publishStatusQuery.data?.isPublished && <a className="mt-3 block truncate text-[11px] text-slate-500 underline underline-offset-2" href={`/site/${publishStatusQuery.data.projectSlug}`} target="_blank" rel="noreferrer">{window.location.origin}/site/{publishStatusQuery.data.projectSlug}</a>}{publishMessage && <p className="mt-2 text-[11px] text-slate-500">{publishMessage}</p>}</div><div className="mt-8 rounded-xl bg-slate-950 p-4 text-white"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-300" /><span className="text-xs font-semibold">Editor guardrails</span></div><p className="mt-2 text-xs leading-5 text-slate-400">Changes stay inside the current Draft. AI edits are reviewed before Apply, and publishing always creates an immutable revision.</p></div>
        </aside>
      </div>
    </div>
  );
}

function PreviewPanel({ viewport, setViewport, srcDoc }: { viewport: "desktop" | "tablet" | "mobile"; setViewport: (viewport: "desktop" | "tablet" | "mobile") => void; srcDoc: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Draft Preview</p><p className="mt-1 text-sm text-slate-500">Read-only · viewport changes never save</p></div><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">{([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([value, Icon]) => <button key={value} onClick={() => setViewport(value)} className={cn("rounded-md p-2 transition", viewport === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-700")} aria-label={`${value} preview`}><Icon className="h-4 w-4" /></button>)}</div></div><div className="mt-4 flex min-h-[660px] justify-center overflow-auto rounded-xl bg-slate-100 p-4"><iframe title="Draft responsive preview" srcDoc={srcDoc} className="min-h-[620px] shrink-0 rounded-lg border border-slate-200 bg-white shadow-xl" style={{ width: viewport === "desktop" ? "100%" : viewport === "tablet" ? "768px" : "390px" }} /></div></div>; }

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
function EmptyWorkspace({ onBuilt }: { onBuilt?: (projectId: number) => void }) { return <ProjectBuilder onBuilt={onBuilt} />; }

function ProjectBuilder({ onBuilt }: { onBuilt?: (projectId: number) => void }) {
  const [step, setStep] = useState<"start" | "brief" | "spec" | "built">("start");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [briefId, setBriefId] = useState<number | null>(null);
  const [siteSpecId, setSiteSpecId] = useState<number | null>(null);
  const [revision, setRevision] = useState(1);
  const [name, setName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [idea, setIdea] = useState("");
  const [brief, setBrief] = useState<any>(null);
  const [siteSpec, setSiteSpec] = useState<any>(null);
  const [error, setError] = useState("");
  const createProject = trpc.architect.createProject.useMutation();
  const createBrief = trpc.architect.createBrief.useMutation();
  const updateBrief = trpc.architect.updateBrief.useMutation();
  const confirmBrief = trpc.architect.confirmBrief.useMutation();
  const generateSiteSpec = trpc.architect.generateSiteSpec.useMutation();
  const confirmSiteSpec = trpc.architect.confirmSiteSpec.useMutation();
  const applySiteSpec = trpc.architect.applySiteSpec.useMutation();
  const busy = createProject.isPending || createBrief.isPending || updateBrief.isPending || confirmBrief.isPending || generateSiteSpec.isPending || confirmSiteSpec.isPending || applySiteSpec.isPending;
  const run = async (action: () => Promise<void>) => { setError(""); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not continue"); } };
  const startProject = () => run(async () => {
    const created = await createProject.mutateAsync({ name: name.trim(), projectSlug: projectSlug.trim(), idea: idea.trim() });
    setProjectId(created.projectId); setRevision(created.revision);
    const generated = await createBrief.mutateAsync({ projectId: created.projectId });
    setBriefId(generated.briefId); setBrief(generated.brief); setStep("brief");
  });
  const saveBrief = () => run(async () => {
    if (!projectId || !briefId || !brief) return;
    await updateBrief.mutateAsync({ projectId, briefId, brief });
    await confirmBrief.mutateAsync({ projectId, briefId });
    const generated = await generateSiteSpec.mutateAsync({ projectId, briefId });
    setSiteSpecId(generated.siteSpecId); setSiteSpec(generated.spec); setStep("spec");
  });
  const buildDraft = () => run(async () => {
    if (!projectId || !siteSpecId) return;
    await confirmSiteSpec.mutateAsync({ projectId, siteSpecId });
    await applySiteSpec.mutateAsync({ projectId, siteSpecId, expectedRevision: revision });
    setStep("built"); onBuilt?.(projectId);
  });
  if (step === "built") return <div className="flex min-h-[calc(100vh-2rem)] flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-white px-6 text-center"><Check className="mb-4 h-10 w-10 text-emerald-500" /><h1 className="text-xl font-semibold tracking-tight text-slate-950">Draft is ready</h1><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Your approved SiteSpec was built into the Draft. Open the Workspace to edit it.</p></div>;
  return <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-3xl items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10"><div className="w-full max-w-xl"><div className="mb-8"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">SiteCraft / New project</div><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Turn an idea into a working Draft</h1><p className="mt-2 text-sm leading-6 text-slate-500">The existing architect flow stays in control: create the project, review the Brief, approve the SiteSpec, then build.</p></div>{error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{step === "start" && <div className="space-y-5"><Field label="Project name"><Input data-testid="create-project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Northstar Studio" /></Field><Field label="Project slug"><Input data-testid="create-project-slug" value={projectSlug} onChange={(event) => setProjectSlug(event.target.value)} placeholder="northstar-studio" /></Field><Field label="IDEA"><Textarea data-testid="create-project-idea" value={idea} onChange={(event) => setIdea(event.target.value)} rows={6} placeholder="A calm portfolio site for a small architecture studio..." /></Field><Button data-testid="create-project-submit" disabled={busy || !name.trim() || !projectSlug.trim() || !idea.trim()} onClick={startProject} className="h-11 rounded-xl bg-slate-950 px-5">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create project</Button></div>}{step === "brief" && brief && <div className="space-y-5"><div><h2 className="text-xl font-semibold text-slate-950">Review the Brief</h2><p className="mt-1 text-sm text-slate-500">Edit the structured brief before it becomes a SiteSpec.</p></div><Field label="Audience"><Textarea data-testid="brief-audience" value={brief.audience} rows={3} onChange={(event) => setBrief({ ...brief, audience: event.target.value })} /></Field><Field label="Value proposition"><Textarea data-testid="brief-value" value={brief.valueProposition} rows={3} onChange={(event) => setBrief({ ...brief, valueProposition: event.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Tone"><SelectField value={brief.tone} onChange={(value) => setBrief({ ...brief, tone: value })} options={["calm", "bold", "editorial", "technical", "warm"]} /></Field><Field label="Primary goal"><SelectField value={brief.primaryGoal} onChange={(value) => setBrief({ ...brief, primaryGoal: value })} options={["book", "buy", "contact", "learn", "subscribe"]} /></Field></div><Button data-testid="confirm-brief" disabled={busy} onClick={saveBrief} className="h-11 rounded-xl bg-slate-950 px-5">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm Brief</Button></div>}{step === "spec" && siteSpec && <div className="space-y-5"><div><h2 className="text-xl font-semibold text-slate-950">Confirm the SiteSpec</h2><p className="mt-1 text-sm text-slate-500">The canonical SiteSpec is validated by the server before Build.</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><div className="font-semibold">{siteSpec.projectName}</div><div className="mt-1 text-slate-500">{siteSpec.pages?.length ?? 0} page(s) · {siteSpec.pages?.reduce((total: number, page: any) => total + page.sections.length, 0) ?? 0} section(s)</div></div><Button data-testid="confirm-sitespec-build" disabled={busy} onClick={buildDraft} className="h-11 rounded-xl bg-slate-950 px-5">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm SiteSpec & Build Draft</Button></div>}</div></div>;
}
