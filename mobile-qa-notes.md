# Mobile QA notes

- At 390px and 320px, Workspace no longer shows clipped desktop columns; it resolves into a single visible pane with Projects / Editor / Properties tabs.
- Projects pane is touch-readable and scrollable; project buttons have comfortable vertical padding.
- Properties pane fits within 390px with readable AI Local Edit and Publish cards; no horizontal clipping observed.
- Header controls wrap cleanly; mobile Preview/Editor control is icon-only with accessible aria-label.
- One script check printed only the selected final pane visibility because hidden panes are not visible; visual screenshots confirm the selected pane renders as intended.

- Populated Stage 7 editor at 390px renders real sections and blocks without horizontal clipping; long text wraps inside cards.
- Populated Properties pane renders full text/select/input controls and AI/Publish cards within the viewport; selected block type remains visible.
- Mobile pane navigation stays visible at the top of each screenshot and supports switching away from the long Projects list.


Final UI verification: `/` на desktop и mobile не показывает горизонтального clipping; workspace shell, pane tabs, empty editor и основные controls помещаются в viewport. `/site/stage7-atelier` вернул plain Not found, но проект имеет publishedRevisionId = NULL, поэтому это ожидаемый 404 после Unpublish. `/404` корректен на desktop/mobile; mobile Go Home не выходит за viewport.


Published route verification: `/site/hardening-1787673283537` с непустым published pointer корректно рендерит опубликованный snapshot на desktop и mobile. На 390px заголовок и body text переносятся, CTA остаётся видимым, image block не выходит за ширину, вертикальный контент не обрезан.


After final UI fixes: desktop workspace remains aligned with no clipping; mobile workspace shows 44px+ Save, Preview, pane tabs and project-create controls. Published route remains readable on mobile with wrapped headline/body and contained image. Missing public route now renders branded SiteCraft HTML 404 with a 44px Return link; SPA `/404` uses the same navy visual language and remains contained.
