import os
import re

def render(project_title, author_name, chapters, content_mode, overrides=None, for_pdf=False) -> str:
    """
    Renders chapters to a standalone HTML file.
    Supports book-ready formatting via overrides.
    """
    # Defaults
    font_size = overrides.get('font_size', 12) if overrides else 12
    # Ensure font_size is at least something reasonable if None passed
    if font_size is None: font_size = 12
    
    gutter = overrides.get('gutter', 0.5) if overrides else 0.5
    if gutter is None: gutter = 0.5
    
    outer = overrides.get('outer', 0.5) if overrides else 0.5
    if outer is None: outer = 0.5
    
    # Load CSS
    css_path = os.path.join(os.path.dirname(__file__), 'templates', 'manuscript.css')
    css_content = ""
    if os.path.exists(css_path):
        with open(css_path, 'r', encoding='utf-8') as f:
            css_content = f.read()
    else:
        # Minimal Fallback
        css_content = "body { font-family: serif; max-width: 800px; margin: 2rem auto; line-height: 1.6; }"
        
    # xhtml2pdf does NOT support CSS variables or calc()
    # We must resolve them manually for PDF or the preview to be reliable
    def resolve_css_vars(css: str) -> str:
        # Resolve variables
        mapping = {
            '--font-size': f"{font_size}pt",
            '--margin-gutter': f"{gutter}in",
            '--margin-outer': f"{outer}in"
        }
        
        # Replace var(--name, fallback)
        def var_replacer(match: re.Match) -> str:
            var_name = match.group(1).strip()
            fallback = match.group(2).strip()
            val = mapping.get(var_name, fallback)
            return str(val) if val is not None else ""
            
        css = re.sub(r'var\((--[a-zA-Z0-9-]+),\s*([^)]+)\)', var_replacer, css)
        
        # Resolve calc() - very specifically for our known usage
        # margin-left: calc(var(--margin-gutter, 0in) + auto);
        # In PDF, auto-margin + calc doesn't work. We'll simplify.
        css = re.sub(r'margin-left:\s*calc\([^)]+\);', f'margin-left: {gutter}in;', css)
        
        return css

    css_content = resolve_css_vars(css_content)
    
    html = []
    html.append("<!DOCTYPE html>")
    html.append("<html lang='en'>")
    html.append("<head>")
    html.append(f"<title>{project_title}</title>")
    html.append("<meta charset='utf-8' />")
    
    if not for_pdf:
        # External fonts often crash xhtml2pdf or cause permission/timeout errors
        html.append("<link rel='preconnect' href='https://fonts.googleapis.com'>")
        html.append("<link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>")
        html.append("<link href='https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900&display=swap' rel='stylesheet'>")
    
    # For PDF, we remove @font-face blocks that point to external URLs to avoid "Permission Denied" crashes
    if for_pdf:
        # Simple regex to strip literata font-face if present (since it's from Google)
        css_content = re.sub(r'@font-face\s*\{[^}]*Literata[^}]*\}', '', css_content, flags=re.I)
        # Use a safe fallback for PDF
        css_content = "body { font-family: 'Times-Roman', 'Helvetica', 'serif'; }\n" + css_content
    
    html.append(f"<style>\n{css_content}</style>")
    html.append("</head>")
    html.append("<body>")
    
    html.append("<header>")
    html.append(f"<h1 class='title'>{project_title}</h1>")
    if author_name:
        html.append(f"<h3 class='author'>{author_name}</h3>")
    html.append("</header>")
    
    global_footnotes = []
    
    for idx, chapter in enumerate(chapters):
        title = chapter.get('title', f"Chapter {idx+1}")
        html.append(f"<section class='chapter'>")
        html.append(f"<h2>{title}</h2>")
            
        text = chapter.get('text', '')
        footnotes = chapter.get('footnotes', [])
        
        # Merge footnotes
        current_fn_offset = len(global_footnotes)
        for i, fn in enumerate(footnotes):
            global_footnotes.append(fn)
            fn_idx = current_fn_offset + i + 1
            # Replace placeholder in text
            text = text.replace(f"[[FOOTNOTE_REF:{i+1}]]", f"<sup><a href='#fn{fn_idx}' id='ref{fn_idx}'>[{fn_idx}]</a></sup>")
            
        # Process markers
        def entity_replacer(match):
            etype = match.group(1)
            eid = match.group(2)
            name = match.group(3)
            desc = match.group(4)
            return f'<span class="entity {etype}" title="{desc}">{name}</span>'
            
        text = re.sub(r'\[\[ENTITY_LINK:([^:]+):([^:]+):([^:]+):([^\]]*)\]\]', entity_replacer, text)
        text = re.sub(r'\[\[ENTITY_REF:[^:]+:([^\]]+)\]\]', r'<span class="entity">\1</span>', text)
        
        # Epistemic markers processing
        if content_mode == 'full':
            text = re.sub(r'\{(secret|knows|believes):([^}]+)\}', r'<aside class="epistemic"><strong>\1:</strong> \2</aside>', text)
        else:
            text = re.sub(r'\{(secret|knows|believes):([^}]+)\}', r'', text)
            
        # TipTap HTML usually already has <p> tags if we didn't strip them.
        # But if we did strip them (e.g. for MD/TXT consistency), we might need to re-wrap.
        # In strip.py for HTML, we set remove_html=False, so we have tags.
        
        html.append(text)
        html.append("</section>")
                
    if global_footnotes:
        html.append("<footer class='footnotes'>")
        html.append("<hr>")
        html.append("<ol>")
        for i, fn in enumerate(global_footnotes):
            html.append(f"<li id='fn{i+1}'><a href='#ref{i+1}'>^</a> {fn}</li>")
        html.append("</ol>")
        html.append("</footer>")
        
    html.append("</body>")
    html.append("</html>")
            
    return "\n".join(html)
