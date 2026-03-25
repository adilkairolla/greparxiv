"""
LaTeX to plain text stripper for arXiv papers.

Goal: produce greppable text, not perfect rendering.
Keep math as-is (researchers grep for \\alpha, \\nabla, etc.).
90% accuracy is fine — remaining noise is still greppable.
"""

import os
import re


def strip_latex(text: str, base_dir: str = "", _depth: int = 0) -> str:
    """Convert LaTeX source to greppable plain text.

    Args:
        text: Raw LaTeX source
        base_dir: Directory containing the .tex files (for resolving \\input)
        _depth: Recursion depth for \\input resolution (max 10)
    """
    # Step 1: Resolve \input and \include
    text = _resolve_inputs(text, base_dir, _depth)

    # Step 2: Strip comments (% to end of line, but not \%)
    text = re.sub(r'(?<!\\)%.*$', '', text, flags=re.MULTILINE)

    # Step 3: Remove preamble (everything before \begin{document})
    doc_start = re.search(r'\\begin\{document\}', text)
    if doc_start:
        text = text[doc_start.end():]

    # Step 4: Remove postamble (everything from \end{document})
    doc_end = re.search(r'\\end\{document\}', text)
    if doc_end:
        text = text[:doc_end.start()]

    # Step 5: Remove environments we don't want (but keep their captions)
    for env in ['figure', 'figure*', 'tikzpicture', 'pgfpicture', 'bytefield',
                'picture', 'filecontents', 'filecontents*']:
        text = _remove_environment(text, env)

    # Step 6: Convert section commands to plain text headers
    for cmd in ['part', 'chapter', 'section', 'subsection', 'subsubsection',
                'paragraph', 'subparagraph']:
        text = re.sub(
            r'\\' + cmd + r'\*?\s*(?:\[[^\]]*\])?\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}',
            r'\n\n\1\n',
            text
        )

    # Step 7: Strip formatting commands (remove command, keep content)
    for cmd in ['textbf', 'textit', 'emph', 'underline', 'texttt', 'textrm',
                'textsf', 'textsc', 'text', 'mathrm', 'mathbf', 'mathit',
                'mathsf', 'mathtt', 'mathcal', 'mathbb', 'mathfrak',
                'boldsymbol', 'bm', 'mbox', 'hbox', 'vbox',
                'title', 'author', 'footnote', 'footnotetext', 'thanks',
                'href', 'url', 'caption', 'caption*']:
        text = _strip_command_keep_arg(text, cmd)

    # Step 8: Handle \item
    text = re.sub(r'\\item\s*(?:\[[^\]]*\])?\s*', '- ', text)

    # Step 9: Remove commands entirely (no content to keep)
    remove_commands = [
        'label', 'ref', 'eqref', 'pageref', 'cite', 'citep', 'citet',
        'citealp', 'citealt', 'citeauthor', 'citeyear', 'nocite',
        'bibliography', 'bibliographystyle', 'usepackage', 'RequirePackage',
        'documentclass', 'newcommand', 'renewcommand', 'providecommand',
        'DeclareMathOperator', 'DeclareMathOperator*',
        'newenvironment', 'renewenvironment',
        'newtheorem', 'newtheorem*', 'theoremstyle',
        'setlength', 'addtolength', 'setcounter', 'addtocounter',
        'pagestyle', 'thispagestyle', 'pagenumbering',
        'vspace', 'vspace*', 'hspace', 'hspace*',
        'includegraphics', 'graphicspath',
        'input', 'include',  # already resolved, remove remnants
        'hypersetup', 'definecolor', 'color', 'textcolor',
    ]
    for cmd in remove_commands:
        text = _remove_command(text, cmd)

    # Step 10: Remove standalone commands (no arguments)
    standalone = [
        'maketitle', 'tableofcontents', 'listoffigures', 'listoftables',
        'noindent', 'clearpage', 'newpage', 'pagebreak', 'linebreak',
        'bigskip', 'medskip', 'smallskip', 'centering', 'raggedright',
        'raggedleft', 'normalsize', 'small', 'footnotesize', 'scriptsize',
        'tiny', 'large', 'Large', 'LARGE', 'huge', 'Huge',
        'appendix', 'frontmatter', 'mainmatter', 'backmatter',
        'par', 'fi', 'else', 'relax', 'protect', 'expandafter',
        'it', 'bf', 'rm', 'sf', 'tt', 'sc', 'sl', 'upshape', 'mdseries',
        'bfseries', 'itshape', 'scshape', 'sffamily', 'rmfamily', 'ttfamily',
        'selectfont', 'normalfont',
    ]
    for cmd in standalone:
        text = re.sub(r'\\' + re.escape(cmd) + r'\b\s*', '', text)

    # Step 11: Remove \def macros and \if conditionals
    text = re.sub(r'\\def\\[a-zA-Z]+[^\n]*\n?', '', text)
    text = re.sub(r'\\(?:if|ifx|ifnum|ifdim|ifcase|iftrue|iffalse|ifvoid|ifhbox|ifvbox|ifeof|ifcat|ifmmode)\b[^\n]*', '', text)
    text = re.sub(r'\\(?:newif|csname|endcsname)\b[^\n]*', '', text)
    # Remove \today
    text = re.sub(r'\\today\b', '', text)

    # Step 11b: Remove \twocolumn[...] and similar layout commands
    text = re.sub(r'\\twocolumn\s*\[', '', text)
    text = re.sub(r'\\onecolumn\b', '', text)
    # Remove \icmltitle, \papertitle, and similar custom title commands
    for cmd in ['icmltitle', 'icmlauthor', 'icmlaffiliation', 'icmlcorrespondingauthor',
                'icmlkeywords', 'papertitle', 'pagerange', 'listoftodos',
                'ifdefined', 'usetodonotes', 'todo']:
        text = _remove_command(text, cmd)
        text = re.sub(r'\\' + re.escape(cmd) + r'\b\s*', '', text)

    # Step 12: Remove \begin{} / \end{} markers for environments we keep
    # (equation, align, theorem, proof, etc.) — keep the content
    text = re.sub(r'\\(?:begin|end)\{[^}]+\}(?:\[[^\]]*\])?', '', text)

    # Step 13: Special character replacements
    text = text.replace('~', ' ')
    text = re.sub(r'\\\\(?:\[[^\]]*\])?', '\n', text)  # \\ and \\[2pt] → newline
    text = re.sub(r'\\[,;:!]', ' ', text)  # thin spaces
    text = text.replace('\\&', '&')
    text = text.replace('\\%', '%')
    text = text.replace('\\$', '$')
    text = text.replace('\\#', '#')
    text = text.replace('\\_', '_')
    text = text.replace('\\{', '{')
    text = text.replace('\\}', '}')
    text = re.sub(r'\\(?:left|right|big|Big|bigg|Bigg)([|()[\]{}.])', r'\1', text)
    text = re.sub(r'\\(?:left|right|big|Big|bigg|Bigg)\.', '', text)

    # Step 14: Remove remaining \command (backslash + letters) that produce no text
    # But preserve math operators and Greek letters (they're useful for grep)
    # Only remove if followed by whitespace or end-of-line (not inside math)
    # Actually, keep all remaining \commands — they're mostly math and useful for grep
    # Just remove \phantom, \vphantom, \hphantom
    text = re.sub(r'\\[vh]?phantom\{[^}]*\}', '', text)

    # Step 15: Clean up braces that are just grouping
    # Remove isolated {} pairs with simple content
    # Be conservative — don't break math
    text = re.sub(r'\{(\w)\}', r'\1', text)  # {x} → x
    text = re.sub(r'\{(\w\w)\}', r'\1', text)  # {xx} → xx

    # Step 16: Whitespace cleanup
    text = re.sub(r'[ \t]+$', '', text, flags=re.MULTILINE)  # trailing spaces
    text = re.sub(r'\n{3,}', '\n\n', text)  # collapse blank lines
    text = text.strip()

    return text


def _resolve_inputs(text: str, base_dir: str, depth: int) -> str:
    """Recursively resolve \\input{} and \\include{} commands."""
    if depth > 10 or not base_dir:
        return text

    def replace_input(match):
        filename = match.group(1).strip()
        # Try with and without .tex extension
        candidates = [
            os.path.join(base_dir, filename),
            os.path.join(base_dir, filename + '.tex'),
        ]
        for path in candidates:
            if os.path.isfile(path):
                try:
                    with open(path, 'r', encoding='utf-8', errors='replace') as f:
                        content = f.read()
                    # Recursively resolve inputs in the included file
                    return _resolve_inputs(content, os.path.dirname(path) or base_dir, depth + 1)
                except Exception:
                    return ''
        return ''  # File not found — remove the command

    text = re.sub(r'\\input\{([^}]+)\}', replace_input, text)
    text = re.sub(r'\\include\{([^}]+)\}', replace_input, text)
    return text


def _remove_environment(text: str, env_name: str) -> str:
    """Remove an entire environment including its content.

    Handles nested braces but not nested same-name environments.
    Extracts \\caption content before removing.
    """
    pattern = re.compile(
        r'\\begin\{' + re.escape(env_name) + r'\}.*?\\end\{' + re.escape(env_name) + r'\}',
        re.DOTALL
    )

    def replace_with_caption(match):
        content = match.group(0)
        # Try to extract caption text
        caption_match = re.search(r'\\caption\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}', content)
        if caption_match:
            return '\n' + caption_match.group(1) + '\n'
        return '\n'

    return pattern.sub(replace_with_caption, text)


def _strip_command_keep_arg(text: str, cmd: str) -> str:
    """Remove a command but keep its argument: \\cmd{content} → content.

    Handles nested braces one level deep.
    """
    # Match \cmd followed by optional [] then {content}
    # Content can contain one level of nested braces
    pattern = re.compile(
        r'\\' + re.escape(cmd) + r'\s*(?:\[[^\]]*\])?\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}'
    )
    return pattern.sub(r'\1', text)


def _remove_command(text: str, cmd: str) -> str:
    """Remove a command and its argument entirely: \\cmd{content} → ''."""
    # Handle optional * suffix
    esc = re.escape(cmd)
    pattern = re.compile(
        r'\\' + esc + r'\*?\s*(?:\[[^\]]*\])*\s*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?'
    )
    return pattern.sub('', text)
