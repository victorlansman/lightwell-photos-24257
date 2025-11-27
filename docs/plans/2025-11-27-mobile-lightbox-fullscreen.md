# Mobile Lightbox Fullscreen UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild lightbox mobile UX with true fullscreen, safe-area support, tap-to-toggle controls, and hamburger menu toolbar.

**Architecture:** Replace Dialog-based positioning with fixed fullscreen overlay. Use CSS `env(safe-area-inset-*)` for notch/island handling. State-driven controls visibility with hamburger menu for toolbar actions. Orientation-aware toolbar layout.

**Tech Stack:** React, Tailwind CSS, Radix Dialog (for accessibility/focus trap only), CSS safe-area-inset, lucide-react icons

---

## Task 1: Create Fullscreen Dialog Variant

**Files:**
- Modify: `src/components/ui/dialog.tsx`

**Step 1: Add DialogContentFullscreen component**

Add after existing DialogContent (around line 52):

```tsx
const DialogContentFullscreen = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className="bg-black" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black",
        // Safe area padding for notch/island
        "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContentFullscreen.displayName = "DialogContentFullscreen";
```

**Step 2: Export the new component**

Update exports at bottom:

```tsx
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogContentFullscreen,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

**Step 3: Verify build passes**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "feat: add DialogContentFullscreen for true fullscreen dialogs"
```

---

## Task 2: Add Controls Visibility State to Lightbox

**Files:**
- Modify: `src/components/Lightbox.tsx:44-57` (state declarations)

**Step 1: Add showControls state and auto-hide timer**

After existing state declarations (line 57), add:

```tsx
const [showControls, setShowControls] = useState(true);
const [showMenu, setShowMenu] = useState(false);
const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Auto-hide controls after 3 seconds
const resetControlsTimeout = useCallback(() => {
  if (controlsTimeoutRef.current) {
    clearTimeout(controlsTimeoutRef.current);
  }
  controlsTimeoutRef.current = setTimeout(() => {
    setShowControls(false);
    setShowMenu(false);
  }, 3000);
}, []);

// Start auto-hide timer when controls are shown
useEffect(() => {
  if (showControls && isOpen) {
    resetControlsTimeout();
  }
  return () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  };
}, [showControls, isOpen, resetControlsTimeout]);
```

**Step 2: Update imports to include useCallback**

Update line 21:
```tsx
import { useState, useEffect, useRef, useCallback } from "react";
```

**Step 3: Add tap handler for toggling controls**

After handleTouchEnd function (around line 206), add:

```tsx
// Tap to toggle controls (only if not swiping)
const handleTap = () => {
  // Don't toggle if we just swiped
  if (touchEndX.current !== null || touchEndY.current !== null) return;
  setShowControls(prev => !prev);
  // Hide menu when hiding controls
  if (showControls) setShowMenu(false);
};
```

**Step 4: Verify build passes**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds (unused vars warning OK for now)

**Step 5: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "feat: add controls visibility state with 3s auto-hide"
```

---

## Task 3: Replace DialogContent with Fullscreen Variant

**Files:**
- Modify: `src/components/Lightbox.tsx`

**Step 1: Update import**

Change line 5 from:
```tsx
import { Dialog, DialogContent } from "@/components/ui/dialog";
```
To:
```tsx
import { Dialog, DialogContent, DialogContentFullscreen } from "@/components/ui/dialog";
```

**Step 2: Replace DialogContent in main lightbox**

Find (around line 604-605):
```tsx
      <Dialog open={isOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[100vw] h-screen p-0 bg-background/95 backdrop-blur-sm border-0 [&>button]:hidden">
```

Replace with:
```tsx
      <Dialog open={isOpen} onOpenChange={handleDialogClose}>
        <DialogContentFullscreen className="[&>button]:hidden">
```

**Step 3: Verify build passes**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "refactor: use fullscreen dialog for lightbox"
```

---

## Task 4: Rebuild Image Container for Full Bleed

**Files:**
- Modify: `src/components/Lightbox.tsx:645-709` (main content area)

**Step 1: Replace main content container**

Find the main content div (lines 645-651):
```tsx
          {/* Main content area */}
          <div
            className="w-full h-full flex"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
```

Replace with:
```tsx
          {/* Main content area - full bleed */}
          <div
            className="w-full h-full flex flex-col"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleTap}
          >
```

**Step 2: Replace image container**

Find (lines 652-659):
```tsx
            {/* Image */}
            <div
              ref={imageRef}
              className={cn(
                "flex-1 flex items-center justify-center p-8 md:p-16 pt-24 transition-all relative z-0",
                showInfo && "lg:pr-8"
              )}
            >
```

Replace with:
```tsx
            {/* Image - minimal padding, safe-area aware */}
            <div
              ref={imageRef}
              className={cn(
                "flex-1 flex items-center justify-center p-2 transition-all relative z-0",
                showInfo && "lg:pr-80"
              )}
            >
```

**Step 3: Update image max-height**

Find (lines 670-673):
```tsx
                  className={cn(
                    "max-w-full max-h-[calc(100vh-8rem)] object-contain animate-fade-in",
                    photoLoading && "opacity-0"
                  )}
```

Replace with:
```tsx
                  className={cn(
                    "max-w-full max-h-full object-contain animate-fade-in",
                    photoLoading && "opacity-0"
                  )}
```

**Step 4: Verify build passes**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "refactor: full bleed image with minimal padding"
```

---

## Task 5: Implement Mobile Header with Hamburger Menu

**Files:**
- Modify: `src/components/Lightbox.tsx`

**Step 1: Add Menu icon to imports**

Update lucide imports (line 3):
```tsx
import { X, ChevronLeft, ChevronRight, Heart, Share2, Download, Info, Users, UserPlus, Check, Loader2, Menu } from "lucide-react";
```

**Step 2: Replace header with mobile-first design**

Find the entire header div (lines 606-643):
```tsx
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-background/80 to-transparent flex flex-wrap items-center justify-between px-4 py-2 z-50 gap-2">
            ...
          </div>
```

Replace with:
```tsx
          {/* Header - only visible when showControls is true */}
          {showControls && (
            <div
              className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-2 py-2"
              style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button - always visible */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-12 w-12 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <X className="h-6 w-6" />
              </Button>

              {/* Menu toggle - mobile only */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMenu(!showMenu)}
                className="h-12 w-12 bg-black/50 hover:bg-black/70 text-white rounded-full md:hidden"
              >
                <Menu className="h-6 w-6" />
              </Button>

              {/* Desktop toolbar - hidden on mobile */}
              <div className="hidden md:flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => { handleToggleFavorite(); resetControlsTimeout(); }} className="h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full">
                  <Heart className={cn("h-5 w-5", photo.is_favorite && "fill-red-500 text-red-500")} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { handleShare(); resetControlsTimeout(); }} className="h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full">
                  <Share2 className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { handleDownload(); resetControlsTimeout(); }} className="h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full">
                  <Download className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setShowFaces(!showFaces); resetControlsTimeout(); }}
                  className={cn("h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full", showFaces && "bg-white/30")}
                >
                  <Users className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setShowInfo(!showInfo); resetControlsTimeout(); }}
                  className={cn("h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full", showInfo && "bg-white/30")}
                >
                  <Info className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
```

**Step 3: Verify build passes**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "feat: mobile-first header with hamburger menu trigger"
```

---

## Task 6: Add Mobile Toolbar Popup

**Files:**
- Modify: `src/components/Lightbox.tsx`

**Step 1: Add mobile toolbar after header**

After the header closing `)}` (after Task 5's header), add:

```tsx
          {/* Mobile toolbar popup */}
          {showControls && showMenu && (
            <div
              className="absolute top-16 right-2 z-50 md:hidden flex flex-col gap-2 p-2 bg-black/80 rounded-2xl backdrop-blur-sm"
              style={{ marginTop: 'env(safe-area-inset-top)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { handleToggleFavorite(); setShowMenu(false); resetControlsTimeout(); }}
                className="h-12 w-12 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <Heart className={cn("h-6 w-6", photo.is_favorite && "fill-red-500 text-red-500")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { handleShare(); setShowMenu(false); resetControlsTimeout(); }}
                className="h-12 w-12 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <Share2 className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { handleDownload(); setShowMenu(false); resetControlsTimeout(); }}
                className="h-12 w-12 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <Download className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setShowFaces(!showFaces); setShowMenu(false); resetControlsTimeout(); }}
                className={cn("h-12 w-12 bg-black/50 hover:bg-black/70 text-white rounded-full", showFaces && "bg-white/30")}
              >
                <Users className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setShowInfo(!showInfo); setShowMenu(false); resetControlsTimeout(); }}
                className={cn("h-12 w-12 bg-black/50 hover:bg-black/70 text-white rounded-full", showInfo && "bg-white/30")}
              >
                <Info className="h-6 w-6" />
              </Button>
            </div>
          )}
```

**Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "feat: add mobile toolbar popup menu"
```

---

## Task 7: Update Navigation Buttons for Mobile

**Files:**
- Modify: `src/components/Lightbox.tsx:773-790` (navigation buttons)

**Step 1: Make nav buttons responsive and controls-aware**

Find navigation buttons (around lines 773-790):
```tsx
          {/* Navigation buttons */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/90 hover:bg-background border border-border shadow-lg z-50 backdrop-blur-sm"
            onClick={onPrevious}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/90 hover:bg-background border border-border shadow-lg z-50 backdrop-blur-sm"
            onClick={onNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
```

Replace with:
```tsx
          {/* Navigation buttons - hidden on mobile (use swipe), visible on desktop */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white z-50 hidden md:flex"
            onClick={(e) => { e.stopPropagation(); onPrevious(); }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white z-50 hidden md:flex"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
```

**Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "refactor: hide nav buttons on mobile (swipe only)"
```

---

## Task 8: Update Add Person Button for Controls Visibility

**Files:**
- Modify: `src/components/Lightbox.tsx:792-815` (add person button)

**Step 1: Make add person button controls-aware**

Find (around lines 792-815):
```tsx
          {/* Add new person / Cancel button */}
          {showFaces && (
            <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-8 z-50 pointer-events-none">
```

Replace with:
```tsx
          {/* Add new person / Cancel button */}
          {showFaces && showControls && (
            <div
              className="absolute bottom-0 left-0 right-0 flex justify-center z-50 pointer-events-none"
              style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
            >
```

**Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "feat: respect safe-area for bottom controls"
```

---

## Task 9: Update Info Panel for Mobile Fullscreen

**Files:**
- Modify: `src/components/Lightbox.tsx:711-770` (info panel)

**Step 1: Update info panel styling**

Find info panel (around lines 711-717):
```tsx
            {/* Info Panel */}
            {showInfo && (
              <div className={cn(
                "absolute bg-card/95 backdrop-blur-sm border-l border-border p-6 space-y-4 overflow-y-auto z-50",
                "lg:relative lg:w-80 lg:h-full lg:z-auto",
                "max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:top-16 max-lg:max-h-[calc(100vh-4rem)] max-lg:border-l-0 max-lg:border-t"
              )}>
```

Replace with:
```tsx
            {/* Info Panel */}
            {showInfo && (
              <div
                className={cn(
                  "absolute bg-black/90 backdrop-blur-sm p-6 space-y-4 overflow-y-auto z-50",
                  "lg:relative lg:w-80 lg:h-full lg:bg-black/80",
                  "max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:max-h-[60vh] max-lg:rounded-t-2xl"
                )}
                style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
                onClick={(e) => e.stopPropagation()}
              >
```

**Step 2: Update info panel text colors**

Find (line 718-719):
```tsx
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Photo Info</h3>
```

Replace with:
```tsx
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Photo Info</h3>
```

Find the muted-foreground classes and update text colors throughout info panel:
- `text-muted-foreground` -> `text-gray-400`
- `text-foreground` -> `text-white`
- `bg-secondary text-secondary-foreground` -> `bg-white/20 text-white`

**Step 3: Verify build passes**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "refactor: dark theme info panel for fullscreen"
```

---

## Task 10: Close Menu on Outside Tap

**Files:**
- Modify: `src/components/Lightbox.tsx`

**Step 1: Update handleTap to close menu**

Find handleTap function (added in Task 2):
```tsx
// Tap to toggle controls (only if not swiping)
const handleTap = () => {
  // Don't toggle if we just swiped
  if (touchEndX.current !== null || touchEndY.current !== null) return;
  setShowControls(prev => !prev);
  // Hide menu when hiding controls
  if (showControls) setShowMenu(false);
};
```

Replace with:
```tsx
// Tap to toggle controls (only if not swiping)
const handleTap = () => {
  // Don't toggle if we just swiped
  if (touchEndX.current !== null || touchEndY.current !== null) return;

  // If menu is open, just close it and reset timer
  if (showMenu) {
    setShowMenu(false);
    resetControlsTimeout();
    return;
  }

  // Toggle controls
  setShowControls(prev => {
    if (!prev) {
      // Showing controls - timer will start via useEffect
      return true;
    }
    return false;
  });
};
```

**Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "fix: tap outside closes menu before toggling controls"
```

---

## Task 11: Final Build and Deploy

**Files:**
- None (verification only)

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Verify type check passes**

Run: `npm run type-check`
Expected: No type errors

**Step 3: Create final commit and push**

```bash
git add -A
git commit -m "feat: mobile lightbox fullscreen UX overhaul

- True fullscreen with safe-area-inset support
- Tap to show/hide controls
- Hamburger menu for toolbar on mobile
- Full bleed image with minimal padding
- Dark theme throughout
- Swipe navigation on mobile, buttons on desktop"
git push origin main
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | DialogContentFullscreen component | 3 min |
| 2 | Controls visibility state | 2 min |
| 3 | Replace DialogContent | 2 min |
| 4 | Full bleed image container | 3 min |
| 5 | Mobile header with hamburger | 5 min |
| 6 | Mobile toolbar popup | 4 min |
| 7 | Navigation buttons responsive | 2 min |
| 8 | Add person button safe-area | 2 min |
| 9 | Info panel dark theme | 4 min |
| 10 | Menu close on tap | 2 min |
| 11 | Final build and deploy | 3 min |
| **Total** | | **~32 min** |

## Unresolved Questions

1. **Landscape toolbar position**: Should the hamburger menu appear on the right in landscape, or should we detect orientation and place it differently?
2. **Controls auto-hide**: Should controls auto-hide after N seconds of inactivity?
3. **Face tagging on mobile**: The face bounding box UI may need separate mobile optimization - defer to follow-up?
