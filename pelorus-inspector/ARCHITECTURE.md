# Pelorus Inspector Architecture

## Overview

Pelorus Inspector is a Tauri desktop application for viewing and analyzing CAN bus data. The frontend is built with vanilla TypeScript Web Components, using a thin shell pattern with dedicated toolbar components.

```
┌─────────────────────────────────────────────────────────────────┐
│                         pelorus-inspector (shell)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ mdf4-toolbar│  │ live-toolbar│  │ dbc-toolbar │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐              │
│  │mdf4-inspector│  │ live-viewer │  │ dbc-editor  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
frontend/
├── lib/
│   ├── pelorus-inspector.ts              # Shell component (thin orchestrator)
│   ├── dbc-mapping.ts             # DBC type mapping (backend → editor)
│   ├── events.ts                  # Event bus (mitt)
│   ├── store.ts                   # Reactive stores (app, live)
│   ├── types.ts                   # Shared TypeScript types
│   ├── renderers.ts               # Table cell renderers
│   ├── config.ts                  # Configuration
│   ├── api/                       # Tauri API abstraction
│   │   └── tauri-api.ts           # Tauri command wrappers + event listeners
│   ├── utils/                     # Shared utilities
│   │   ├── formatters.ts          # Value formatting
│   │   ├── dlc-detection.ts       # DLC detection logic
│   │   ├── html.ts                # HTML escaping (XSS prevention)
│   │   └── helpers.ts             # General helpers
│   └── components/
│       ├── toolbars/              # Dedicated toolbar components
│       │   ├── mdf4-toolbar.ts
│       │   ├── live-toolbar.ts
│       │   └── dbc-toolbar.ts
│       ├── status/                # Header status indicators
│       │   ├── dbc-status.ts
│       │   └── mdf4-status.ts
│       ├── mdf4-inspector/        # MDF4 file viewer
│       ├── live-viewer/           # Live CAN capture
│       ├── dbc-editor/            # DBC file editor
│       └── shared/                # Shared sub-components
│           ├── frames-table.ts    # Reusable frames table
│           ├── signals-panel.ts   # Signal display panel
│           ├── filters-panel.ts   # Frame filtering
│           ├── capture-controls.ts # Capture start/stop controls
│           └── dbc-viewer.ts      # DBC info display
├── styles/
│   └── pelorus-inspector.css             # Global styles
└── main.ts                        # Entry point

src/
├── main.rs                        # Tauri entry point
├── lib.rs                         # Library exports
├── commands/                      # Tauri commands (IPC handlers)
│   ├── dbc.rs                     # DBC load/save/decode
│   ├── mdf4.rs                    # MDF4 load/export
│   └── capture.rs                 # Live capture start/stop
├── state.rs                       # Shared application state
├── config.rs                      # Configuration persistence
└── render/                        # Server-side HTML rendering
    └── live.rs                    # Live capture HTML generation
```

## Data Flow

### Rust Backend to TypeScript Frontend

```
┌─────────────────┐     Tauri Events      ┌─────────────────┐
│   Rust Backend  │ ──────────────────────> │  tauri-api.ts   │
│                 │   (can-frame, etc.)    │   (Gateway)     │
└─────────────────┘                        └────────┬────────┘
                                                    │
                                                    │ emit to mitt
                                                    ▼
                                           ┌─────────────────┐
                                           │   events.ts     │
                                           │   (Event Bus)   │
                                           └────────┬────────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                              ▼                     ▼                     ▼
                       ┌───────────┐         ┌───────────┐         ┌───────────┐
                       │ Component │         │ Component │         │  Toolbar  │
                       │     A     │         │     B     │         │     C     │
                       └───────────┘         └───────────┘         └───────────┘
```

**Key points:**
- `tauri-api.ts` wraps Tauri's `listen()` and `invoke()` functions
- Backend events (like `can-frame`) are converted to mitt events
- Components subscribe to the mitt event bus, not Tauri directly
- This decouples components from Tauri specifics

## Communication Patterns

### Event Bus (mitt)

Used for cross-component communication. Events are typed and infrequent.

```typescript
// events.ts
export type AppEvents = {
  'dbc:changed': DbcChangedEvent;           // DBC loaded/cleared/updated
  'dbc:state-change': DbcStateChangeEvent;  // Editor dirty/editing state
  'mdf4:changed': Mdf4ChangedEvent;         // MDF4 loaded/cleared
  'frame:selected': FrameSelectedEvent;     // Frame selected in table
  'frame:received': CanFrame;               // Live frame from backend
  'capture:started': CaptureStartedEvent;
  'capture:stopped': CaptureStoppedEvent;
  'live:interfaces-loaded': LiveInterfacesLoadedEvent;
  'tab:switch': TabSwitchEvent;             // Request tab change
};

export const events = mitt<AppEvents>();
```

**Usage:**
```typescript
// Emit
emitDbcChanged({ action: 'loaded', dbcInfo, filename });

// Subscribe (in connectedCallback)
events.on('dbc:changed', this.handleDbcChanged);

// Unsubscribe (in disconnectedCallback)
events.off('dbc:changed', this.handleDbcChanged);
```

### Stores (Reactive State)

Two stores separate infrequent state from high-frequency updates:

```typescript
// App state - file paths and loaded data (infrequent updates)
export const appStore = createStore<AppState>({
  dbcFile: null,
  mdf4File: null,
  mdf4Frames: [],
  mdf4Signals: [],
});

// Live capture state - updates every 100ms during capture
export const liveStore = createStore<LiveState>({
  isCapturing: false,
  currentInterface: null,
  frameCount: 0,
  messageCount: 0,
});
```

**Usage:**
```typescript
// Update
liveStore.set({ frameCount: this.frameBuffer.length });

// Subscribe
this.unsubscribe = liveStore.subscribe((state) => this.updateUI(state));

// Read current value
const state = liveStore.get();
```

### When to Use Which

| Scenario | Use | Reason |
|----------|-----|--------|
| File loaded/cleared | Event + Store | Event notifies, store holds data |
| Frame received (live) | Event | High frequency, listeners process individually |
| Capture started/stopped | Event | Infrequent state change |
| Frame count during capture | Store | UI polling every 100ms |
| Tab switch request | Event | Status components request navigation |

## Component Responsibilities

### Shell (pelorus-inspector.ts)

- Routes between tabs (MDF4, Live, DBC, About)
- Renders toolbar components in tab panes
- Wires toolbar events to component methods
- Manages shared DBC state for header display
- Handles initial file loading from CLI args
- **Does NOT** manage toolbar UI state

### Toolbar Components

Self-contained components that:
- Subscribe to relevant events/store on mount
- Unsubscribe on unmount
- Manage their own button states and status indicators
- Emit click events for the shell to forward

```typescript
// Example: mdf4-toolbar.ts
connectedCallback(): void {
  this.render();
  this.bindEvents();
  this.unsubscribe = appStore.subscribe(() => this.updateStatusUI());
  events.on('capture:started', this.handleCaptureStarted);
  events.on('capture:stopped', this.handleCaptureStopped);
}

disconnectedCallback(): void {
  this.unsubscribe?.();
  events.off('capture:started', this.handleCaptureStarted);
  events.off('capture:stopped', this.handleCaptureStopped);
}
```

### Status Components

Independent header indicators that show current file status:
- **dbc-status**: Shows DBC file status (green when loaded, yellow when dirty)
- **mdf4-status**: Shows MDF4 file status (green when loaded, yellow during capture)

Status components:
- Subscribe to `appStore` for file paths
- Subscribe to `liveStore` for capture state
- Subscribe to events for state changes
- Emit `tab:switch` event on click to request navigation
- Are completely decoupled from the shell

### Feature Components

- **mdf4-inspector**: Static MDF4 file viewing, filtering, signal decoding
- **live-viewer**: Real-time CAN capture with ring buffer, message monitor
- **dbc-editor**: DBC file creation and editing

Each feature component:
- Has its own API interface for Tauri commands
- Manages its internal state
- Emits events for cross-component communication
- Does NOT contain toolbar UI

## Data Flow Examples

### Loading an MDF4 File

```
1. User clicks "Open" in mdf4-toolbar
   └─> toolbar dispatches 'open' event

2. Shell receives event, calls mdf4Inspector.promptLoadMdf4()
   └─> mdf4-inspector opens file dialog via Tauri API

3. File selected, backend loads frames + decodes signals if DBC loaded
   └─> Returns (frames, decodedSignals) to frontend
   └─> Updates appStore.set({ mdf4File, mdf4Frames, mdf4Signals })
   └─> Calls emitMdf4Changed({ action: 'loaded' })

4. mdf4-toolbar subscription to appStore fires
   └─> Updates status dot and filename display

5. User clicks frame in table
   └─> mdf4-inspector filters mdf4Signals by timestamp (no IPC!)
   └─> Falls back to decodeFrames API if no pre-decoded signals
```

### Live Capture Flow

```
1. User clicks Start in live-toolbar
   └─> Shell calls liveViewer.startCapture(interface)

2. Rust backend starts SocketCAN capture
   └─> Emits 'can-frame' Tauri events

3. tauri-api.ts receives events
   └─> Calls events.emit('frame:received', frame)

4. live-viewer listens to 'frame:received'
   └─> Buffers frames, updates ring buffer
   └─> Every 100ms: liveStore.set({ frameCount, ... })

5. live-toolbar subscription to liveStore fires
   └─> Updates export button state, status display
```

## Styling

All components share a single CSS file (`pelorus-inspector.css`) imported via Vite's `?inline` syntax. Components use class prefixes:

- `.cv-` - Pelorus Inspector shell and shared
- `.de-` - DBC Editor specific

Shadow DOM is used for encapsulation, with styles injected into each component's shadow root.

## Security

HTML content is escaped using `escapeHtml()` from `utils/html.ts` to prevent XSS:

```typescript
import { escapeHtml } from './utils/html';

// Safe: user input is escaped
element.innerHTML = `<div>${escapeHtml(userInput)}</div>`;
```

## Testing

```bash
# Frontend tests
cd frontend && npm test

# Rust tests
cargo test

# All tests (via pre-commit hook)
./setup-git-hooks.sh  # Once
git commit            # Runs all checks
```
