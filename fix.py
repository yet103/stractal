import sys

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove draw calls in render
content = content.replace("    drawScheduleBars();\n", "")
content = content.replace("    drawScheduleBarPreview();\n", "")

# 2. Remove scheduleBar hit tests
content = content.replace("      const schedBar = hitTestScheduleBar(pos.x, pos.y);\n", "")
content = content.replace("      const sbResizeCheck = hitTestScheduleBarResize(pos.x, pos.y);\n", "")

# 3. Clean up setToolActive / mousedown tool checks
content = content.replace("state.tool === 'scheduleBar' || ", "")

# 4. Remove scheduleBar from getSelectedObject
content = content.replace("      if (state.selectedType === 'scheduleBar') return state.scheduleBars.find(b => b.id === state.selectedId);\n", "")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed render crashing bugs')
