import sys
import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove scheduleBar resize block in mousedown
content = re.sub(
    r"\s*// Check for scheduleBar resize\s*(?:const sbResize = hitTestScheduleBarResize\(pos\.x, pos\.y\);\s*)?if \(sbResize\) \{.*?\n\s*\}\s*\}\n",
    "\n",
    content,
    flags=re.DOTALL
)

# 2. Remove scheduleBar click block in mousedown
content = re.sub(
    r"\s*// Check for scheduleBar click\s*(?:const schedBar = hitTestScheduleBar\(pos\.x, pos\.y\);\s*)?if \(schedBar\) \{.*?\n\s*\}\n",
    "\n",
    content,
    flags=re.DOTALL
)

# 3. Fix ternary in mousemove
old_ternary = "container.style.cursor = shapeCheck ? 'grab' : (sbResizeCheck ? 'ew-resize' : (wpHandle ? 'move' : (mpHandle ? 'pointer' : (person ? 'grab' : (region ? 'move' : (textAnn ? 'grab' : (schedBar ? 'grab' : (connectorLine ? 'pointer' : 'default'))))))));"
new_ternary = "container.style.cursor = shapeCheck ? 'grab' : (wpHandle ? 'move' : (mpHandle ? 'pointer' : (person ? 'grab' : (region ? 'move' : (textAnn ? 'grab' : (connectorLine ? 'pointer' : 'default'))))));"
content = content.replace(old_ternary, new_ternary)

# 4. Remove scheduleBar dblclick
content = re.sub(
    r"\s*// ScheduleBar label editing\s*(?:const schedBar = hitTestScheduleBar\(pos\.x, pos\.y\);\s*)?if \(schedBar\) \{.*?\n\s*\}\n",
    "\n",
    content,
    flags=re.DOTALL
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed leftover scheduleBar blocks')
