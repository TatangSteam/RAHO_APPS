# Responsive Design Guide

## Overview
Aplikasi ini telah dioptimalkan untuk responsive dari desktop hingga iPhone dengan pendekatan mobile-first menggunakan Tailwind CSS dan custom utilities.

## Breakpoints

### Tailwind Default Breakpoints
- **xs**: 0-639px (phones - iPhone SE, iPhone 12/13/14)
- **sm**: 640px+ (large phones, small tablets)
- **md**: 768px+ (tablets - iPad)
- **lg**: 1024px+ (desktops, laptops)
- **xl**: 1280px+ (large desktops)
- **2xl**: 1536px+ (extra large)

### Custom Breakpoints (globals.css)
- **< 390px**: iPhone SE and smaller
- **< 640px**: All mobile phones
- **< 1024px**: Tablets and smaller

## Responsive Utilities

### Custom CSS Classes (Available in globals.css)

#### Display Control
```css
.hidden-mobile   /* Hide on mobile (< 640px) */
.show-mobile     /* Show only on mobile */
```

#### Layout
```css
.mobile-full     /* Full width on mobile */
.mobile-stack    /* Stack vertically on mobile */
.mobile-center   /* Center content on mobile */
```

#### Spacing
```css
.mobile-compact     /* Reduced padding on mobile */
.mobile-no-margin   /* Remove margins on mobile */
```

## Best Practices

### 1. Modal Components
Always use responsive width classes:

```tsx
// ✅ Good - Responsive modal
<div className="w-full max-w-[95vw] sm:max-w-md lg:max-w-2xl">

// ❌ Bad - Fixed width
<div className="w-[600px]">
```

### 2. Tables
Always wrap tables in responsive container:

```tsx
// ✅ Good
<div className="overflow-x-auto">
  <table className="w-full">
    ...
  </table>
</div>
```

Use sticky columns for key data on mobile:

```tsx
<th className="sticky left-0 z-20 bg-white dark:bg-neutral-900">
  No
</th>
```

### 3. Forms
Stack form inputs on mobile:

```tsx
// ✅ Good
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <input />
  <input />
</div>
```

### 4. Navigation
Hide labels on mobile, show icons:

```tsx
// ✅ Good
<button>
  <Icon />
  <span className="hidden sm:inline">Label</span>
</button>
```

### 5. Padding & Spacing
Use responsive padding:

```tsx
// ✅ Good
<div className="p-2 sm:p-4 lg:p-6">

// ❌ Bad - Fixed padding
<div className="p-6">
```

### 6. Font Sizes
Use responsive text sizes:

```tsx
// ✅ Good
<h1 className="text-xl sm:text-2xl lg:text-3xl">

// ❌ Bad
<h1 className="text-3xl">
```

### 7. Grid Layouts
Always specify mobile column count:

```tsx
// ✅ Good
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

// ❌ Bad
<div className="grid grid-cols-3 gap-4">
```

## Component-Specific Guidelines

### Modals
```tsx
<div className="fixed inset-0 z-[9999] overflow-hidden">
  <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
    <div className="relative w-full max-w-[95vw] sm:max-w-md lg:max-w-2xl 
                    max-h-[92vh] sm:max-h-[85vh] flex flex-col 
                    bg-white dark:bg-neutral-900 rounded-2xl">
      {/* Header - Sticky */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 sticky top-0 z-30">
        {/* Content */}
      </div>
      
      {/* Body - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {/* Content */}
      </div>
      
      {/* Footer - Sticky */}
      <div className="px-4 sm:px-6 py-4 sticky bottom-0">
        {/* Actions */}
      </div>
    </div>
  </div>
</div>
```

### Tables with Horizontal Scroll
```tsx
<div className="overflow-x-auto">
  <table className="w-full min-w-[800px]">
    <thead>
      <tr>
        <th className="sticky left-0 z-20 bg-white dark:bg-neutral-900">
          No
        </th>
        {/* Other columns */}
      </tr>
    </thead>
    <tbody>
      {/* Rows */}
    </tbody>
  </table>
</div>
```

### Cards
```tsx
<div className="bg-white dark:bg-neutral-900 rounded-lg sm:rounded-xl 
                p-3 sm:p-4 lg:p-6">
  {/* Content */}
</div>
```

### Buttons
```tsx
{/* Mobile: Icon only, Desktop: Icon + Text */}
<button className="px-3 sm:px-4 py-2 sm:py-2.5">
  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
  <span className="hidden sm:inline ml-2">Label</span>
</button>

{/* Full width on mobile */}
<button className="w-full sm:w-auto px-4 py-2">
  Submit
</button>
```

## Testing Checklist

### Device Testing
- [ ] iPhone SE (375x667)
- [ ] iPhone 12/13/14 (390x844)
- [ ] iPhone 14 Pro Max (430x932)
- [ ] iPad (768x1024)
- [ ] iPad Pro (1024x1366)
- [ ] Desktop (1920x1080)

### Features to Test
- [ ] Modal dialogs (open, scroll, close)
- [ ] Forms (input, validation, submission)
- [ ] Tables (horizontal scroll, sticky columns)
- [ ] Navigation (sidebar, mobile menu)
- [ ] Cards (layout, spacing)
- [ ] Buttons (size, placement)
- [ ] Typography (readability)
- [ ] Images (aspect ratio, loading)

### Viewport Meta Tag
Pastikan `viewport` tag ada di `layout.tsx`:

```tsx
export const metadata = {
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
}
```

## Common Issues & Solutions

### Issue: Text Overflow
```tsx
// ✅ Solution
<p className="truncate max-w-full sm:max-w-xs">
  {longText}
</p>
```

### Issue: Horizontal Scroll on Body
```tsx
// ✅ Solution - Add to container
<div className="overflow-x-hidden max-w-full">
```

### Issue: Fixed Width Breaking Mobile
```tsx
// ❌ Bad
<div style={{ width: '800px' }}>

// ✅ Good
<div className="w-full max-w-[800px]">
```

### Issue: Buttons Too Small on Mobile
```tsx
// ✅ Solution - Minimum touch target 44x44px
<button className="min-h-[44px] min-w-[44px] p-2 sm:p-3">
```

## Performance Tips

1. **Lazy Load Images**: Use Next.js Image component
2. **Conditional Rendering**: Hide complex components on mobile if needed
3. **Reduce Animations**: Use `prefers-reduced-motion` media query
4. **Optimize Fonts**: Subset fonts for faster load
5. **Code Splitting**: Dynamic imports for heavy components

## Resources

- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [Web.dev Mobile UX](https://web.dev/mobile-ux/)

---

**Last Updated**: 13 Juni 2026
**Applies To**: All components in `/apps/web/src`
