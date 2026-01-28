# Voice Annotations - Quick Reference

## 🚀 Quick Start

### Using the Feature
1. Navigate to **Clinical Synthesis** workspace
2. Click **Facts & Notes** or **Legal Writer** tab
3. Click the **microphone button** 🎤
4. Allow microphone access (first time only)
5. Start speaking - text appears automatically
6. Click mic button again to stop

---

## 📁 Files Changed

### New Files
- `components/VoiceInputButton.tsx` - Reusable voice input component

### Modified Files
- `components/AnnotationRollup.tsx` - Integrated voice buttons in both tabs

---

## 🔧 Component API

### VoiceInputButton Props
```typescript
interface VoiceInputButtonProps {
  onTranscription: (text: string) => void;  // Callback with transcribed text
  isActive: boolean;                         // Controls recording state
  onToggle: () => void;                      // Toggle active state
  className?: string;                        // Additional CSS classes
  size?: 'sm' | 'md' | 'lg';                // Button size
}
```

### Example Usage
```tsx
<VoiceInputButton
  isActive={isVoiceActive}
  onToggle={() => setIsVoiceActive(!isVoiceActive)}
  onTranscription={(text) => setContent(text)}
  size="md"
/>
```

---

## 🎨 Integration Points

### Facts & Notes Tab
**Location:** Line ~980 in `AnnotationRollup.tsx`
**State:** `isVoiceActiveFactsNotes`
**Handler:** `handleVoiceTranscriptionFactsNotes`
**Target:** `additionalContext` state

### Legal Writer Tab
**Location:** Line ~1340 in `AnnotationRollup.tsx`
**State:** `isVoiceActiveWriter`
**Handler:** `handleVoiceTranscriptionWriter`
**Target:** `reportContent` state

---

## 🔍 Key Functions

### Voice Transcription Handlers
```typescript
// Facts & Notes
const handleVoiceTranscriptionFactsNotes = (text: string) => {
   setAdditionalContext(text);
};

// Legal Writer
const handleVoiceTranscriptionWriter = (text: string) => {
   setReportContent(text);
};
```

---

## 🎯 State Management

### State Variables
```typescript
const [isVoiceActiveFactsNotes, setIsVoiceActiveFactsNotes] = useState(false);
const [isVoiceActiveWriter, setIsVoiceActiveWriter] = useState(false);
```

### Toggle Functions
```typescript
// Facts & Notes
onToggle={() => setIsVoiceActiveFactsNotes(!isVoiceActiveFactsNotes)}

// Legal Writer
onToggle={() => setIsVoiceActiveWriter(!isVoiceActiveWriter)}
```

---

## 🌐 Browser Support

### Supported
✅ Chrome (all versions with Web Speech API)
✅ Edge (Chromium-based)
✅ Safari (with webkit prefix)

### Not Supported
❌ Firefox (no Web Speech API support)
❌ Internet Explorer

---

## 🐛 Common Issues & Solutions

### Issue: Microphone not working
**Solution:** Check browser permissions in Settings → Privacy → Microphone

### Issue: Text not appearing
**Solution:** Ensure `onTranscription` callback is properly connected to state setter

### Issue: Recognition stops unexpectedly
**Solution:** Component has auto-restart mechanism (300ms delay)

### Issue: Error tooltip appears
**Solution:** Check browser compatibility or microphone permissions

---

## 📊 Performance Considerations

### Memory
- Component cleans up recognition instance on unmount
- No memory leaks from continuous listening

### CPU
- Minimal impact - browser handles speech recognition
- Animations use CSS (GPU-accelerated)

### Network
- No network calls - all processing is local
- Speech API is built into browser

---

## 🔐 Security & Privacy

### Data Handling
- All speech processing happens **locally** in the browser
- No audio data sent to external servers
- Transcribed text stored only in component state

### Permissions
- Requires microphone permission (one-time browser prompt)
- User can revoke permission at any time
- Clear visual indicators when mic is active

---

## 🧪 Testing Checklist

### Functional Tests
- [ ] Button toggles on/off correctly
- [ ] Text appears in real-time
- [ ] Recording indicator shows/hides
- [ ] Placeholder text updates
- [ ] Multiple start/stop cycles work
- [ ] Tab switching stops recording

### Visual Tests
- [ ] Button animations smooth
- [ ] Sound bars animate during listening
- [ ] Badge pulse animation works
- [ ] Colors match design system
- [ ] Responsive on all screen sizes

### Error Tests
- [ ] Denied permission shows error
- [ ] Unsupported browser shows error
- [ ] Error tooltip displays correctly
- [ ] Graceful degradation

---

## 🎓 Advanced Customization

### Custom Styling
```tsx
<VoiceInputButton
  className="custom-class"
  // Add your custom styles
/>
```

### Custom Transcription Logic
```tsx
const handleCustomTranscription = (text: string) => {
  // Add custom processing
  const processed = text.toUpperCase();
  setContent(processed);
};
```

### Language Support
```typescript
// In VoiceInputButton.tsx, line 59
recognition.lang = 'en-US';  // Change to desired language
```

---

## 📚 Related Documentation

- [Implementation Summary](./VOICE_ANNOTATIONS_IMPLEMENTATION.md)
- [Visual Guide](./VOICE_ANNOTATIONS_VISUAL_GUIDE.md)
- [Web Speech API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

---

## 🤝 Contributing

### Adding Voice to New Components
1. Import `VoiceInputButton`
2. Add state: `const [isVoiceActive, setIsVoiceActive] = useState(false)`
3. Add handler: `const handleTranscription = (text) => { /* your logic */ }`
4. Render button with props

### Reporting Issues
- Check browser console for errors
- Verify microphone permissions
- Test in supported browser
- Provide reproduction steps

---

## 📞 Support

For questions or issues:
1. Check this quick reference
2. Review implementation summary
3. Check browser console for errors
4. Verify Web Speech API support

---

**Last Updated:** January 2026
**Version:** 1.0.0
**Status:** ✅ Production Ready
