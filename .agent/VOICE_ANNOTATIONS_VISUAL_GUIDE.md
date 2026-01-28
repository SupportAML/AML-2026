# Voice Annotations Feature - Visual Guide

## 📍 Location 1: Facts & Notes Tab

### Toolbar Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  [📄] [📅] [🎤] ┊ Recording ●  │         Link Source: [Doc1]   │
└─────────────────────────────────────────────────────────────────┘
```

### Button States

#### Inactive State
```
┌──────┐
│  🎙️  │  ← Gray microphone icon
└──────┘
```

#### Active State (Waiting)
```
┌──────┐
│  🎤  │  ← Blue background, white mic icon
└──────┘  ← Red pulsing dot badge
   ●
```

#### Active State (Listening)
```
┌──────┐
│ ▂▄▂▄▂│  ← Animated sound bars
└──────┘
   ●
```

### Recording Indicator
```
┌─────────────────────┐
│ ● Recording         │  ← Red badge with pulsing dot
└─────────────────────┘
```

### Textarea Behavior

**Before Voice Activation:**
```
┌─────────────────────────────────────────────────┐
│ # Annotations                                   │
│ (1/24/2026, 1:30:00 PM)                        │
│                                                 │
│ ## Clinic Records                               │
│ * Patient observations go here...               │
│ * Use (["Source", p. 1]) for references.       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**During Voice Activation:**
```
┌─────────────────────────────────────────────────┐
│ 🎤 Listening... Speak your clinical notes      │
│                                                 │
│ [Transcribed text appears here in real-time]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📍 Location 2: Legal Writer Tab

### Action Bar Layout
```
┌──────────────────────────────────────────────────────────────────────┐
│ 📄 Confidential Medical-Legal Report                                │
│    Single-Page Workspace                                             │
│                                                                       │
│ [✨ Auto-Draft] │ [🎤] ┊ Voice Active ●  │ [📋] [📦]                │
└──────────────────────────────────────────────────────────────────────┘
```

### Button States (Same as Facts & Notes)

#### Inactive
```
┌──────┐
│  🎙️  │
└──────┘
```

#### Active (Waiting)
```
┌──────┐
│  🎤  │
└──────┘
   ●
```

#### Active (Listening)
```
┌──────┐
│ ▂▄▂▄▂│
└──────┘
   ●
```

### Recording Indicator
```
┌─────────────────────┐
│ ● Voice Active      │  ← Red badge with pulsing dot
└─────────────────────┘
```

### Document Textarea Behavior

**Before Voice Activation:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Start typing your professional medical-legal report       │
│  here...                                                    │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**During Voice Activation:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🎤 Listening... Speak to dictate your report              │
│                                                             │
│  [Your dictated report appears here in real-time]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Visual Design Elements

### Color Scheme

**Inactive Button:**
- Background: White (#FFFFFF)
- Border: Slate-200 (#E2E8F0)
- Icon: Slate-500 (#64748B)

**Active Button:**
- Background: Indigo-600 (#4F46E5)
- Icon: White (#FFFFFF)
- Badge: Red-500 (#EF4444) with pulse animation

**Recording Indicator:**
- Background: Red-50 (#FEF2F2)
- Border: Red-100 (#FEE2E2)
- Text: Red-600 (#DC2626)
- Dot: Red-600 (#DC2626) with pulse animation

### Animations

**Sound Bars (Listening State):**
```
Bar 1: ▂ → ▄ → ▂  (0.8s cycle)
Bar 2: ▄ → ▆ → ▄  (0.8s cycle, 0.1s delay)
Bar 3: ▁ → ▃ → ▁  (0.8s cycle, 0.2s delay)
Bar 4: ▄ → ▆ → ▄  (0.8s cycle, 0.1s delay)
Bar 5: ▂ → ▄ → ▂  (0.8s cycle)
```

**Pulse Animation (Badge Dot):**
```
0%:   ● (opacity: 1, scale: 1)
50%:  ◉ (opacity: 0.5, scale: 1.2)
100%: ● (opacity: 1, scale: 1)
```

---

## 🔄 User Flow Diagram

### Facts & Notes Tab Flow
```
┌─────────────────┐
│ User clicks mic │
│     button      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Browser asks    │
│ for mic access  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Button turns    │
│ blue, badge     │
│ appears         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ User speaks     │
│ clinical notes  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Text appears    │
│ in real-time    │
│ in textarea     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ User clicks mic │
│ to stop         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Button returns  │
│ to gray, badge  │
│ disappears      │
└─────────────────┘
```

### Legal Writer Tab Flow
```
[Same flow as Facts & Notes, but with report content]
```

---

## 📱 Responsive Behavior

### Desktop (>1024px)
- Full-size buttons (md: 40x40px for Writer, sm: 32x32px for Facts)
- Recording indicators fully visible
- Smooth animations

### Tablet (768px - 1024px)
- Slightly smaller buttons
- Recording indicators may wrap
- Animations maintained

### Mobile (<768px)
- Compact buttons
- Recording text abbreviated
- Essential animations only

---

## ⚠️ Error States

### Microphone Permission Denied
```
┌──────┐
│  🎙️  │
└──────┘
   │
   └─► [Tooltip: "Microphone access denied."]
```

### Browser Not Supported
```
┌──────┐
│  🎙️  │
└──────┘
   │
   └─► [Tooltip: "Speech recognition not supported in this browser."]
```

### No Speech Detected
```
[Button remains active, waiting for speech]
[Auto-restarts recognition after brief pause]
```

---

## 🎯 Accessibility Features

1. **Tooltips:** Hover over mic button shows "Start voice input" / "Stop voice input"
2. **Visual Feedback:** Multiple indicators (button color, badge, placeholder text)
3. **Keyboard Accessible:** Can be activated via keyboard navigation
4. **Screen Reader:** Button has proper ARIA labels

---

## 💡 Tips for Best Results

1. **Speak Clearly:** Enunciate words for better accuracy
2. **Pause Between Thoughts:** Allows for better sentence structure
3. **Use Punctuation Commands:** Say "period", "comma", "new line" for formatting
4. **Review & Edit:** Always review transcribed text for accuracy
5. **Quiet Environment:** Reduces background noise interference

---

This visual guide demonstrates the complete user interface and interaction patterns for the voice annotations feature in both tabs.
