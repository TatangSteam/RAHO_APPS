# Responsive Design Quick Reference

## 🎯 Breakpoints
```
xs:  0-639px   📱 iPhone SE, iPhone 12/13/14
sm:  640px+    📱 Large phones
md:  768px+    📱 iPad, tablets  
lg:  1024px+   💻 Laptops, desktops
xl:  1280px+   🖥️  Large desktops
```

## 🔧 Common Patterns

### Modal
```tsx
<div className="w-full max-w-[95vw] sm:max-w-md lg:max-w-2xl max-h-[92vh]">
```

### Padding
```tsx
<div className="p-2 sm:p-4 lg:p-6">
```

### Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Stack on Mobile
```tsx
<div className="flex flex-col sm:flex-row gap-3">
```

### Button Group
```tsx
<button className="w-full sm:w-auto px-4 py-2">
```

### Hide/Show
```tsx
<div className="hidden sm:block">Desktop only</div>
<div className="block sm:hidden">Mobile only</div>
```

### Font Size
```tsx
<h1 className="text-xl sm:text-2xl lg:text-3xl">
```

### Table
```tsx
<div className="overflow-x-auto">
  <table className="w-full min-w-[800px]">
```

### Sticky Column
```tsx
<th className="sticky left-0 z-20 bg-white dark:bg-neutral-900">
```

## 🎨 Custom Utilities

```css
.hidden-mobile    /* Hide on < 640px */
.show-mobile      /* Show only on < 640px */
.mobile-full      /* Full width on mobile */
.mobile-stack     /* Column on mobile */
.mobile-center    /* Center on mobile */
.mobile-compact   /* Less padding on mobile */
```

## ✅ Checklist

- [ ] Modal: `max-w-[95vw]`
- [ ] Padding: `p-2 sm:p-4`
- [ ] Grid: `grid-cols-1 sm:grid-cols-*`
- [ ] Buttons: `w-full sm:w-auto`
- [ ] Tables: `overflow-x-auto`
- [ ] Text: `text-sm sm:text-base`
- [ ] Touch target: `min-h-[44px]`
- [ ] Max height: `max-h-[92vh]`

## 📱 Test Devices

- iPhone SE (375x667)
- iPhone 14 (390x844)
- iPad (768x1024)
- Desktop (1920x1080)

## 🔗 Resources

- Full Guide: `docs/RESPONSIVE-DESIGN-GUIDE.md`
- Tailwind Docs: https://tailwindcss.com/docs/responsive-design
