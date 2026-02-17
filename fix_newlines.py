import re

with open(r'd:\SSD DATA\Projects\copy-of-apexmedlaw-working-before-merger-2\components\AnnotationRollup.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the line with proper newlines
old_pattern = r'const html = parse\(generatedReport\) as string;\\n\s*\\n\s*// CRITICAL.*?\\n\s*onUpdateCase.*?reportContent: html.*?\\n'
new_text = '''const html = parse(generatedReport) as string;
                                              
                                              // CRITICAL: Save immediately to prevent data loss if user switches tabs
                                              onUpdateCase({ ...caseItem, reportContent: html });
'''

content = re.sub(old_pattern, new_text, content, flags=re.DOTALL)

with open(r'd:\SSD DATA\Projects\copy-of-apexmedlaw-working-before-merger-2\components\AnnotationRollup.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Fixed!")
