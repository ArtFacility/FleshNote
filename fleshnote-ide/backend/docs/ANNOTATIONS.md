# Annotation System

FleshNote offers an inline Annotation workflow, allowing you to attach contextual editorial notes or comments directly onto selected text in the editor. Introduced in `v0.8.7`.

## Features
- **Inline Note Attachment:** Right-click directly onto any text selection to attach a persistent inline annotation or personal remark.
- **Export Modal Flexibility:** These annotations interact deeply with the exporting pipeline (DOCX, HTML, PDF, EPUB).
- During exporting under the `Full Annotated` or `With Annotations` mode, standard annotations are intelligently extracted from the prose flow and reformatted sequentially as footnotes, adhering to industry styling formats.
- They stay completely out of the way when exporting cleanly using `Prose Only` mode.

## System Impact
- Annotation markers are converted in the Stage 2 Render processing during export.
- Twist markers and foreshadowing cleanly separate from working annotations.
