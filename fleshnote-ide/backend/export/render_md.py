import re
import datetime

def render(project_title, author_name, chapters, content_mode) -> str:
    """
    Renders chapters directly to a Portable Markdown document.
    """
    output_lines = []
    
    # Frontmatter
    output_lines.extend([
        "---",
        f"title: \"{project_title}\"",
        f"author: \"{author_name}\"",
        f"date: \"{datetime.date.today().isoformat()}\"",
        "---",
        ""
    ])
    
    global_footnotes = []
    
    for idx, chapter in enumerate(chapters):
        title = chapter.get('title', f"Chapter {idx+1}")
        
        output_lines.extend([f"# {title}", ""])
            
        text = chapter.get('text', '')
        footnotes = chapter.get('footnotes', [])
        
        # Merge footnotes to global pool
        current_fn_offset = len(global_footnotes)
        for i, fn in enumerate(footnotes):
            global_footnotes.append(fn)
            fn_idx = current_fn_offset + i + 1
            # Replace placeholder in text
            text = text.replace(f"[[FOOTNOTE_REF:{i+1}]]", f"[^{fn_idx}]")
            
        # Process Entity Links
        if content_mode == 'full':
            # Bold them
            text = re.sub(r'\[\[ENTITY_REF:[^:]+:([^\]]+)\]\]', r'**\1**', text)
            text = re.sub(r'\[\[ENTITY_LINK:[^:]+:[^:]+:([^:]+):([^\]]*)\]\]', r'**\1**', text)
        else:
            text = re.sub(r'\[\[ENTITY_REF:[^:]+:([^\]]+)\]\]', r'\1', text)
            text = re.sub(r'\[\[ENTITY_LINK:[^:]+:[^:]+:([^:]+):[^\]]*\]\]', r'\1', text)
            
        # Epistemic markers processing
        if content_mode == 'full':
            text = re.sub(r'\{(secret|knows|believes):([^}]+)\}', r'\n> [\1: \2]\n', text)
        else:
            text = re.sub(r'\{(secret|knows|believes):([^}]+)\}', r'', text)
        
        # Split into blocks and clean up
        blocks = text.split('\n')
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            if block in ('---', '***', '* * *'):
                output_lines.extend(["---", ""])
            else:
                output_lines.extend([block, ""])
                
    if global_footnotes:
        output_lines.extend(["", "---", ""])
        for i, fn in enumerate(global_footnotes):
            output_lines.append(f"[^{i+1}]: {fn}")
            
    return "\n".join(output_lines)
