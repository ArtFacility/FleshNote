import re

def render(chapters, content_mode) -> str:
    """
    Renders chapters to a standard non-formatted text document.
    """
    output = []
    global_footnotes = []
    
    for idx, chapter in enumerate(chapters):
        title = chapter.get('title', f"CHAPTER {idx+1}")
        output.append(title.upper())
        output.append("-" * len(title))
        output.append("")
        
        text = chapter.get('text', '')
        footnotes = chapter.get('footnotes', [])
        
        # Merge footnotes
        current_fn_offset = len(global_footnotes)
        for i, fn in enumerate(footnotes):
            global_footnotes.append(fn)
            fn_idx = current_fn_offset + i + 1
            # Replace placeholder in text
            text = text.replace(f"[[FOOTNOTE_REF:{i+1}]]", f"[{fn_idx}]")
            
        # Clean up remaining entity markers (should already be resolved by strip.py)
        text = re.sub(r'\[\[ENTITY_REF:[^:]+:([^\]]+)\]\]', r'\1', text)
        text = re.sub(r'\[\[ENTITY_LINK:[^:]+:[^:]+:([^:]+):[^\]]*\]\]', r'\1', text)
        
        # Cleanup epistemic markers
        text = re.sub(r'\{(secret|knows|believes):([^}]+)\}', r'', text)
        
        # Paragraph handling: Strip.py already handled basic newline conversion
        # but let's ensure double spacing between blocks
        blocks = text.split('\n')
        for block in blocks:
            b = block.strip()
            if not b: continue
            
            if b in ('---', '***', '* * *'):
                output.append("   * * *")
            else:
                output.append(b)
            output.append("") # Double space
            
        output.append("") # Triple space between chapters
        output.append("")
        
    if global_footnotes:
        output.append("NOTES")
        output.append("=====")
        output.append("")
        for i, fn in enumerate(global_footnotes):
            output.append(f"[{i+1}] {fn}")
            output.append("")
            
    return "\n".join(output)
