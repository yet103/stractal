import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace all multiSelection literals with emptyMultiSelection() call
# Pattern: state.multiSelection = { ... scheduleBarIds ... };
# We want to replace all the verbose literals with emptyMultiSelection()
old_patterns = [
    "{ personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] }",
    "{ personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [\n], shapeIds: [] }",
]
for pat in old_patterns:
    content = content.replace(pat, "emptyMultiSelection()")

# 2. Fix hasMultiSelection - remove scheduleBarIds check
content = content.replace(
    " || (state.multiSelection.scheduleBarIds || []).length > 0",
    ""
)

# 3. Remove selectedType === 'scheduleBar' branch in getSelectedObject
content = content.replace(
    "      if (state.selectedType === 'scheduleBar') return state.scheduleBars.find(b => b.id === state.selectedId);\n",
    ""
)

# 4. Remove scheduleBar-props hide in updatePropsPanel
content = content.replace(
    "    const schedBarPropsEl = document.getElementById('scheduleBar-props');\n    if (schedBarPropsEl) schedBarPropsEl.style.display = 'none';\n",
    ""
)

# 5. Remove selectedType === 'scheduleBar' block in updatePropsPanel
content = re.sub(
    r"\s*\} else if \(state\.selectedType === 'scheduleBar'\) \{[^}]*\}",
    "",
    content,
    count=1
)

# 6. Remove selectedBarIds filter in mouseup range-select
content = re.sub(
    r"\s*const selectedBarIds = state\.scheduleBars\.filter\(b =>.*?\)\.map\(b => b\.id\);\n",
    "\n",
    content,
    flags=re.DOTALL,
    count=1
)

# 7. Remove scheduleBarIds delete loop in deleteSelected
content = re.sub(
    r"\s*// Delete multi-selected scheduleBars\s*\(state\.multiSelection\.scheduleBarIds \|\| \[\]\)\.forEach\(bid => \{\s*state\.scheduleBars = state\.scheduleBars\.filter\(b => b\.id !== bid\);\s*\}\);\n",
    "",
    content
)

# 8. Remove selectedType === 'scheduleBar' delete branch
content = re.sub(
    r"\s*\} else if \(state\.selectedType === 'scheduleBar'\) \{\s*state\.scheduleBars = state\.scheduleBars\.filter\(b => b\.id !== state\.selectedId\);\s*\}",
    "",
    content,
    count=1
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
