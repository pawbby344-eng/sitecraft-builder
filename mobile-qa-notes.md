# Mobile QA notes

- At 390px and 320px, Workspace no longer shows clipped desktop columns; it resolves into a single visible pane with Projects / Editor / Properties tabs.
- Projects pane is touch-readable and scrollable; project buttons have comfortable vertical padding.
- Properties pane fits within 390px with readable AI Local Edit and Publish cards; no horizontal clipping observed.
- Header controls wrap cleanly; mobile Preview/Editor control is icon-only with accessible aria-label.
- One script check printed only the selected final pane visibility because hidden panes are not visible; visual screenshots confirm the selected pane renders as intended.

- Populated Stage 7 editor at 390px renders real sections and blocks without horizontal clipping; long text wraps inside cards.
- Populated Properties pane renders full text/select/input controls and AI/Publish cards within the viewport; selected block type remains visible.
- Mobile pane navigation stays visible at the top of each screenshot and supports switching away from the long Projects list.
