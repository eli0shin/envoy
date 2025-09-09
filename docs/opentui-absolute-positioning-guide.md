# OpenTUI Absolute Positioning Guide

## Overview

OpenTUI uses the **Yoga Layout Engine** (Facebook's CSS Flexbox implementation) for positioning. Understanding how absolute positioning works is crucial for creating floating UI elements like autocomplete dropdowns, modals, and overlays.

## Key Concepts

### Position Types

OpenTUI supports three position types:
- `"relative"` (default) - Elements flow normally, children positioned relative to parent
- `"absolute"` - Removed from normal flow, positioned relative to nearest positioned ancestor  
- `"static"` - Exists but behaves like relative

**Note:** There is no `position: "fixed"` in OpenTUI.

### Position Properties

```typescript
// Core positioning
position: "relative" | "absolute"

// Directional properties (all support number, "auto", or percentage strings)
top?: number | "auto" | `${number}%`
right?: number | "auto" | `${number}%`
bottom?: number | "auto" | `${number}%`
left?: number | "auto" | `${number}%`

// Stacking order
zIndex?: number // Default: 0
```

## The Problem with Absolute Positioning

In our slash command autocomplete implementation, we discovered that **absolute positioning requires careful consideration of the positioning context**. Simply adding `position="absolute"` wasn't enough - the element needs:

1. A positioned parent (`position="relative"`)
2. Proper directional properties (`top`, `bottom`, `left`, `right`)
3. Appropriate `zIndex` for stacking order

## How Absolute Positioning Works

### Positioning Context

```typescript
// Parent must be positioned for absolute children to position relative to it
<box position="relative">
  {/* This will position relative to the parent box */}
  <box 
    position="absolute"
    top={-10}
    left={0}
    zIndex={100}
  >
    Floating content
  </box>
</box>
```

### Without Positioned Parent

If no parent has `position="relative"` or `position="absolute"`, the absolutely positioned element positions relative to the root viewport.

## Z-Index and Stacking Contexts

### Critical Rules

1. **Parent z-index creates a stacking context** - Children cannot escape it
2. **Higher parent z-index always wins** - Even if child has z-index: 9999
3. **Siblings sort by z-index** - Within the same parent

### Example

```typescript
// Parent A (z-index: 100) 
<box position="relative" zIndex={100}>
  <box zIndex={1}>This renders above everything in Parent B</box>
</box>

// Parent B (z-index: 50)
<box position="relative" zIndex={50}>
  <box zIndex={9999}>Still renders below Parent A's children!</box>
</box>
```

## Common Patterns

### Floating Dropdown/Autocomplete

```typescript
<box position="relative">
  <input />
  {showDropdown && (
    <box 
      position="absolute"
      top={inputHeight + 2}  // Position below input
      left={0}
      right={0}
      zIndex={100}
      borderStyle="single"
    >
      {/* Dropdown content */}
    </box>
  )}
</box>
```

### Overlay/Modal

```typescript
<box 
  position="absolute"
  top={0}
  left={0}
  right={0}
  bottom={0}
  zIndex={1000}
  backgroundColor="rgba(0,0,0,0.5)"
>
  <box /* modal content *//>
</box>
```

### Tooltip

```typescript
<box position="relative">
  <text>Hover me</text>
  {showTooltip && (
    <box
      position="absolute"
      bottom={-20}  // Below the text
      left="50%"    // Centered
      zIndex={500}
    >
      Tooltip text
    </box>
  )}
</box>
```

## Gotchas and Solutions

### 1. Element Not Appearing

**Problem:** Absolutely positioned element doesn't show up.

**Solution:** Ensure parent has `position="relative"` and check z-index.

### 2. Wrong Position

**Problem:** Element positions relative to wrong container.

**Solution:** Add `position="relative"` to the intended parent container.

### 3. Z-Index Not Working

**Problem:** High z-index doesn't bring element to front.

**Solution:** Check parent's z-index - may need to increase parent's z-index or move element to different parent.

### 4. Percentage Positioning

**Problem:** Percentages don't work as expected.

**Solution:** Percentages are relative to parent size, not viewport. Parent must have defined dimensions.

### 5. Negative Positioning

**Problem:** Need to position above/outside parent.

**Solution:** Use negative values for `top` or `left`:
```typescript
top={-(height + margin)} // Position above parent
```

## Best Practices

1. **Always set positioning context** - Add `position="relative"` to parent containers
2. **Use high z-index sparingly** - Reserve 1000+ for true overlays
3. **Consider layout flow** - Absolute elements don't affect sibling positions
4. **Test with different content** - Ensure positioning works with variable content
5. **Document z-index levels** - Maintain a z-index scale in your app

## Z-Index Scale Recommendation

```typescript
// Suggested z-index scale
const Z_INDEX = {
  dropdown: 100,
  tooltip: 500,
  modal: 1000,
  notification: 1500,
  debug: 9999,
} as const;
```

## Debugging Tips

1. **Add borders** - Use `borderStyle="double"` and bright `borderColor` to see element bounds
2. **Use contrasting backgrounds** - Make absolutely positioned elements visually obvious
3. **Log position values** - Check calculated positions match expectations
4. **Simplify first** - Start with basic positioning, then add complexity

## Summary

Absolute positioning in OpenTUI follows CSS Flexbox rules via the Yoga layout engine. The key to success is understanding positioning contexts, z-index stacking, and the relationship between parent and child positioning. When in doubt, ensure your parent has `position="relative"` and use appropriate z-index values to control stacking order.