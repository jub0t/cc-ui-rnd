// Hide the console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use slint::{Model, ModelRc, SharedString, Timer, TimerMode, VecModel};

slint::include_modules!();

/// Effect names handed out as the demo adds rows, matching the web POOL.
const POOL: [&str; 6] = [
    "Sharpen",
    "Vignette",
    "Chroma Key",
    "Reverb",
    "Compressor",
    "De-esser",
];

/// x of a cubic bezier with endpoints pinned at 0 and 1, at parameter `t`.
fn bezier_axis(p1: f32, p2: f32, t: f32) -> f32 {
    let u = 1.0 - t;
    3.0 * u * u * t * p1 + 3.0 * u * t * t * p2 + t * t * t
}

fn bezier_axis_slope(p1: f32, p2: f32, t: f32) -> f32 {
    let u = 1.0 - t;
    3.0 * u * u * p1 + 6.0 * u * t * (p2 - p1) + 3.0 * t * t * (1.0 - p2)
}

/// Solve a CSS cubic-bezier for y at a given x: Newton first, bisection as the
/// fallback where the curve is flat enough that Newton stalls. This is the
/// computation Slint's expression language cannot express — it has no loops —
/// so the timing function is evaluated here and read back through a global.
fn bezier_y_at_x(x1: f32, y1: f32, x2: f32, y2: f32, x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    let mut t = x;

    for _ in 0..8 {
        let error = bezier_axis(x1, x2, t) - x;
        if error.abs() < 1e-5 {
            return bezier_axis(y1, y2, t);
        }
        let slope = bezier_axis_slope(x1, x2, t);
        if slope.abs() < 1e-6 {
            break;
        }
        t -= error / slope;
    }

    let (mut lo, mut hi) = (0.0_f32, 1.0_f32);
    t = x;
    for _ in 0..24 {
        let at = bezier_axis(x1, x2, t);
        if (at - x).abs() < 1e-5 {
            break;
        }
        if at > x {
            hi = t;
        } else {
            lo = t;
        }
        t = (lo + hi) / 2.0;
    }
    bezier_axis(y1, y2, t)
}

/// "hh:mm:ss", "mm:ss" or "ss" -> seconds. Slint's string type has no split().
fn parse_timecode(text: &str) -> f32 {
    text.split(':')
        .rev()
        .enumerate()
        .map(|(index, part)| {
            part.trim().parse::<f32>().unwrap_or(0.0) * 60_f32.powi(index as i32)
        })
        .sum()
}

/// "hh:mm:ss:ff" -> frames. Short forms count from the right, so "12" is
/// twelve frames and "3:00" is three seconds — which is how anyone types into
/// a timecode field that is already showing them the shape.
fn parse_frames(text: &str, rate: f32) -> f32 {
    let fps = rate.round().max(1.0);
    let parts: Vec<f32> = text
        .split(':')
        .map(|part| part.trim().parse::<f32>().unwrap_or(0.0))
        .collect();
    let frames = parts.last().copied().unwrap_or(0.0);
    let seconds: f32 = parts
        .iter()
        .rev()
        .skip(1)
        .enumerate()
        .map(|(index, part)| part * 60_f32.powi(index as i32))
        .sum();
    (seconds * fps + frames).max(0.0)
}

/// "0.42, 0, 0.58, 1" -> Bezier, falling back to the current curve when the
/// text is not four numbers.
fn parse_bezier(text: &str, fallback: Bezier) -> Bezier {
    let parts: Vec<f32> = text
        .split(',')
        .filter_map(|part| part.trim().parse::<f32>().ok())
        .collect();
    match parts[..] {
        [x1, y1, x2, y2] => Bezier { x1, y1, x2, y2 },
        _ => fallback,
    }
}

/// The bin, held here rather than in Slint.
///
/// Slint's expression language cannot filter a model, and filtering inside the
/// panel's `for` would leave holes in the grid's indices — the cards are
/// placed by arithmetic on the row number, so row 4 being invisible would
/// leave a gap where a card should be. So the whole library lives here and the
/// panel is handed exactly the rows it should draw, plus the counts of the
/// rows it should not.
struct Library {
    items: RefCell<Vec<MediaItemData>>,
    filter: Cell<MediaFilter>,
}

impl Library {
    fn new(items: Vec<MediaItemData>) -> Self {
        Self { items: RefCell::new(items), filter: Cell::new(MediaFilter::All) }
    }

    fn shows(filter: MediaFilter, kind: MediaKind) -> bool {
        match filter {
            MediaFilter::All => true,
            MediaFilter::Video => kind == MediaKind::Video,
            MediaFilter::Audio => kind == MediaKind::Audio,
            MediaFilter::Images => kind == MediaKind::Image,
        }
    }

    fn count(&self, kind: MediaKind) -> i32 {
        self.items.borrow().iter().filter(|item| item.kind == kind).count() as i32
    }

    /// Republishes the filtered view and every count the sidebar reads. Called
    /// after anything at all changes: the bin is tens of rows, not thousands,
    /// and one path that always produces a consistent panel is worth more than
    /// the row-level updates it could be split into.
    fn publish(&self, app: &App, view: &VecModel<MediaItemData>) {
        let filter = self.filter.get();
        let items = self.items.borrow();

        view.set_vec(
            items
                .iter()
                .filter(|item| Self::shows(filter, item.kind))
                .map(|item| {
                    let mut row = item.clone();
                    // The same envelope, from the same seed, as the clip cut
                    // from this file: `m{id}` is what the demo timeline's
                    // clips name as their media, so a file looks like itself
                    // in the bin and on a lane.
                    if item.kind == MediaKind::Audio {
                        row.wave =
                            wave_path(&format!("m{}", item.id), 0.0, item.duration, 1.0).into();
                    }
                    row
                })
                .collect::<Vec<_>>(),
        );

        app.set_media_count_all(items.len() as i32);
        app.set_media_count_video(self.count(MediaKind::Video));
        app.set_media_count_audio(self.count(MediaKind::Audio));
        app.set_media_count_images(self.count(MediaKind::Image));
        app.set_media_selected_count(
            items.iter().filter(|item| item.selected).count() as i32
        );
    }
}

fn media(id: i32, name: &str, kind: MediaKind, duration: f32) -> MediaItemData {
    MediaItemData {
        id,
        name: SharedString::from(name),
        kind,
        duration,
        // No decoder in this tree yet, so no artwork: the card falls back to
        // the kind's tint and mark, which is what it does in the reference
        // until the filmstrip or the peaks arrive.
        ..Default::default()
    }
}

/// A bin the size of a real one, so the grid is exercised at the widths a
/// splitter drag actually produces.
fn demo_library() -> Vec<MediaItemData> {
    use MediaKind::{Audio, Video};
    vec![
        media(1, "ElevenLabs_2026-08-16T09-12-04_intro.mp3", Audio, 3.4),
        media(2, "0001-0036.mp4", Video, 1.2),
        media(3, "0036-0072.mp4", Video, 1.2),
        media(4, "0072-0134.mp4", Video, 2.1),
        media(5, "0134-0182.mp4", Video, 1.6),
        media(6, "0232-0322.mp4", Video, 3.0),
        media(7, "0326-0452.mp4", Video, 4.2),
        media(8, "0456-0524.mp4", Video, 2.3),
        media(9, "0528-0604.mp4", Video, 2.5),
        media(10, "0604-0642.mp4", Video, 1.3),
        media(11, "0654-0725.mp4", Video, 2.4),
        media(12, "0730-0781.mp4", Video, 1.7),
        media(13, "ElevenLabs_2026-08-16T09-14-22_line-02.mp3", Audio, 1.9),
        media(14, "ElevenLabs_2026-08-16T09-15-40_line-03.mp3", Audio, 2.6),
        media(15, "ElevenLabs_2026-08-16T09-17-01_line-04.mp3", Audio, 7.8),
        media(16, "ElevenLabs_2026-08-16T09-18-33_line-05.mp3", Audio, 4.5),
        media(17, "ElevenLabs_2026-08-16T09-20-09_outro.mp3", Audio, 5.2),
    ]
}

/// Programme level for the meter: fast attack, slow release, with a peak hold
/// that decays after 900ms — the behaviour the web demo fakes in a rAF loop.
struct LevelSim {
    seed: Cell<u32>,
    current: Cell<f32>,
    held: Cell<f32>,
    hold_frames: Cell<u32>,
    elapsed: Cell<f32>,
}

impl LevelSim {
    fn new() -> Self {
        Self {
            seed: Cell::new(0x2545_f491),
            current: Cell::new(0.0),
            held: Cell::new(0.0),
            hold_frames: Cell::new(0),
            elapsed: Cell::new(0.0),
        }
    }

    fn random(&self) -> f32 {
        // xorshift32, so the demo needs no rand dependency
        let mut x = self.seed.get();
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.seed.set(x);
        (x >> 8) as f32 / (1 << 24) as f32
    }

    /// Advances one tick and returns (level, peak).
    fn tick(&self, dt: f32) -> (f32, f32) {
        self.elapsed.set(self.elapsed.get() + dt);
        let target = 0.45 + (self.elapsed.get() * 2.4).sin() * 0.2 + self.random() * 0.25;
        let current = self.current.get();
        let next = if target > current {
            target
        } else {
            current + (target - current) * 0.08
        };
        self.current.set(next);

        let frames = self.hold_frames.get();
        if next > self.held.get() || frames == 0 {
            self.held.set(next);
            self.hold_frames.set(27); // ~900ms at 33ms per tick
        } else {
            self.hold_frames.set(frames - 1);
        }
        (next, self.held.get())
    }

    fn reset(&self) {
        self.current.set(0.0);
        self.held.set(0.0);
        self.hold_frames.set(0);
    }
}


// ─── the timeline ───────────────────────────────────────────────────────────
//
// The project, held here for the reason the bin is: a chain is edited by index
// and a Slint model cannot be spliced from the language. Slint is handed a
// flattened view — clips already carrying the row they draw on — and every
// mutation ends in the same `publish`, so there is one place where the panel's
// idea of the timeline can go wrong.

/// The ruler's tick ladder. The smallest interval still at least 90px apart at
/// this zoom, which is a table search — a loop, and so not something Slint's
/// expression language can express.
const TICKS: [f32; 16] = [
    1.0 / 30.0, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 15.0, 30.0, 60.0, 120.0,
    300.0, 600.0, 1800.0, 3600.0,
];

fn tick_interval(seconds_per_pixel: f32) -> f32 {
    TICKS
        .iter()
        .copied()
        .find(|interval| interval / seconds_per_pixel >= 90.0)
        .unwrap_or(3600.0)
}


// ─── the dialogs ────────────────────────────────────────────────────────────

/// Export output sizes, matching the picker's rows.
const EXPORT_SIZES: [(i32, i32); 4] = [(3840, 2160), (2560, 1440), (1920, 1080), (1280, 720)];
const EXPORT_RATES: [f32; 3] = [24.0, 30.0, 60.0];
/// Video bitrate in Mbps at 1080p30, scaled by pixel count and frame rate —
/// the model web/'s export panel uses, because the number it produces is the
/// one the choice is actually made on.
const EXPORT_TIERS: [f32; 3] = [16.0, 8.0, 4.0];
const AUDIO_BPS: f32 = 192_000.0;

struct ExportState {
    open: bool,
    name: String,
    folder: String,
    resolution: usize,
    rate: usize,
    quality: usize,
    phase: ExportPhase,
    progress: f32,
    message: String,
}

impl Default for ExportState {
    fn default() -> Self {
        Self {
            open: false,
            name: "Untitled project".into(),
            folder: "~/Movies/WolfCut".into(),
            // 1080p30 balanced: the middle of every list, which is what a
            // default should be when the project has not said otherwise.
            resolution: 2,
            rate: 1,
            quality: 1,
            phase: ExportPhase::Idle,
            progress: 0.0,
            message: String::new(),
        }
    }
}

struct SettingsState {
    open: bool,
    tab: i32,
    language: usize,
    transcribe_language: i32,
}

impl Default for SettingsState {
    fn default() -> Self {
        Self { open: false, tab: 0, language: 0, transcribe_language: 0 }
    }
}

#[derive(Clone)]
struct ModelState {
    id: String,
    name: String,
    note: String,
    /// on disk, in megabytes
    megabytes: f32,
    accuracy: i32,
    installed: bool,
    active: bool,
    /// megabytes fetched so far, while a download is in flight
    fetched: Option<f32>,
}

fn demo_transcribers() -> Vec<ModelState> {
    vec![
        ModelState { id: "tiny".into(), name: "Tiny".into(), note: "Fastest, roughest".into(), megabytes: 78.0, accuracy: 1, installed: true, active: false, fetched: None },
        ModelState { id: "base".into(), name: "Base".into(), note: "Quick, usable for notes".into(), megabytes: 148.0, accuracy: 2, installed: true, active: true, fetched: None },
        ModelState { id: "small".into(), name: "Small".into(), note: "The usual choice".into(), megabytes: 488.0, accuracy: 3, installed: false, active: false, fetched: None },
        ModelState { id: "medium".into(), name: "Medium".into(), note: "Slower, noticeably better".into(), megabytes: 1530.0, accuracy: 4, installed: false, active: false, fetched: None },
        ModelState { id: "large".into(), name: "Large v3".into(), note: "Best, and it will cost you".into(), megabytes: 3090.0, accuracy: 5, installed: false, active: false, fetched: None },
    ]
}

fn demo_voices() -> Vec<ModelState> {
    vec![
        ModelState { id: "vc-en".into(), name: "English · Neutral".into(), note: "Two speakers, 22kHz".into(), megabytes: 63.0, accuracy: 3, installed: true, active: true, fetched: None },
        ModelState { id: "vc-en-hq".into(), name: "English · Studio".into(), note: "One speaker, 48kHz".into(), megabytes: 214.0, accuracy: 5, installed: false, active: false, fetched: None },
        ModelState { id: "vc-zh".into(), name: "Chinese · Neutral".into(), note: "Two speakers, 22kHz".into(), megabytes: 71.0, accuracy: 3, installed: false, active: false, fetched: None },
    ]
}

/// Bytes in the units a person reads them in.
fn bytes(count: f32) -> String {
    if count >= 1_000_000_000.0 {
        format!("{:.1} GB", count / 1_000_000_000.0)
    } else if count >= 1_000_000.0 {
        format!("{:.0} MB", count / 1_000_000.0)
    } else {
        format!("{:.0} KB", (count / 1_000.0).max(1.0))
    }
}

/// Seconds as a rough remaining time. Rough on purpose: a countdown to the
/// second on an estimate that is not accurate to the second is theatre.
fn eta(seconds: f32) -> String {
    if seconds <= 1.0 {
        "almost done".into()
    } else if seconds < 60.0 {
        format!("{:.0}s left", seconds)
    } else {
        format!("{:.0}m {:02.0}s left", (seconds / 60.0).floor(), seconds % 60.0)
    }
}

/// The monitor's output sizes, matching the picker's rows.
const OUTPUTS: [(i32, i32); 6] = [
    (1920, 1080),
    (3840, 2160),
    (1080, 1920),
    (1080, 1080),
    (1440, 1080),
    (2560, 1080),
];

/// Shortest clip the editor will make: a sixtieth of a second, as the
/// reference's model puts it. Trims and splits both floor at this.
const MIN_DURATION: f32 = 1.0 / 60.0;

#[derive(Clone)]
struct ClipDoc {
    id: String,
    name: String,
    kind: ClipKind,
    /// Track id, not a row: rows are a fact about the view, and a clip that
    /// stored one would be wrong the moment a lane above it was removed.
    track: String,
    /// The file behind it, for the peaks. Empty for a title.
    media: String,
    start: f32,
    duration: f32,
    /// In-point: how far into the media the clip starts.
    source_start: f32,
    /// Multiplier over the fitted size; 1 fills the frame, preserving aspect.
    scale: f32,
    /// Offset from centred, as a fraction of frame width / height.
    offset_x: f32,
    offset_y: f32,
    /// Clockwise degrees about the picture's centre.
    rotation: f32,
    opacity: f32,
    /// Playback rate; 1 is normal.
    speed: f32,
    /// Keep voices at their natural pitch when `speed` is not 1. On by
    /// default; off gives the tape-machine sound.
    preserve_pitch: bool,
    volume: f32,
    fade_in: f32,
    fade_out: f32,
    fx: bool,
    transition_in: bool,
    text_body: String,
    /// On a detached audio clip: the video clip the sound came from.
    detached_from: Option<String>,
    /// The overlay, when this is a text clip. Every field is a fraction of the
    /// output frame rather than an absolute size: the frame can be any
    /// resolution, and a title dialled in at 1080p should not move at 4K.
    text: TextStyleDoc,
}

#[derive(Clone)]
struct TextStyleDoc {
    family: String,
    /// share of frame height
    size: f32,
    weight: f32,
    italic: bool,
    fill: slint::Color,
    align: TextAlignment,
    opacity: f32,
    stroke_width: f32,
    stroke: slint::Color,
    shadow: bool,
    /// The plate behind the words. Fully transparent is how "no plate" is
    /// stored — it is a colour, not a flag, so turning it off is clearing it.
    plate: slint::Color,
    line_height: f32,
    tracking: f32,
}

impl Default for TextStyleDoc {
    fn default() -> Self {
        Self {
            family: "Inter".into(),
            size: 0.09,
            weight: 600.0,
            italic: false,
            fill: slint::Color::from_rgb_u8(0xff, 0xff, 0xff),
            align: TextAlignment::Center,
            opacity: 1.0,
            stroke_width: 0.0,
            stroke: slint::Color::from_rgb_u8(0x00, 0x00, 0x00),
            plate: slint::Color::from_argb_u8(0, 0, 0, 0),
            shadow: true,
            line_height: 1.2,
            tracking: 0.0,
        }
    }
}

/// "#rrggbb", for the readout beside a swatch — Slint cannot print a colour.
fn hex_of(colour: slint::Color) -> String {
    format!("#{:02x}{:02x}{:02x}", colour.red(), colour.green(), colour.blue())
}

impl ClipDoc {
    fn end(&self) -> f32 {
        self.start + self.duration
    }
}

#[derive(Clone)]
struct TrackDoc {
    id: String,
    name: String,
    visible: bool,
    muted: bool,
    /// Nothing on this lane can be selected, moved, trimmed or cut, and
    /// nothing can be dropped onto it.
    locked: bool,
}

struct TimelineDoc {
    id: String,
    name: String,
    /// Bottom-most lane first, matching the reference — that is the engine's
    /// compositing order. The panel draws the top lane first, so every place
    /// that speaks in rows goes through `row_track`.
    tracks: Vec<TrackDoc>,
    clips: Vec<ClipDoc>,
}

/// Which edge of a clip a trim has hold of.
#[derive(Clone, Copy, PartialEq)]
enum Edge {
    Start,
    End,
}

/// Where one clip sat when a gesture began, so the whole set moves rigidly.
struct MoveOrigin {
    clip: String,
    start: f32,
    row: i32,
}

enum Gesture {
    None,
    Move {
        /// The clip actually grabbed; it is the one that snaps.
        primary: String,
        origins: Vec<MoveOrigin>,
    },
    Trim {
        clip: String,
        edge: Edge,
        start: f32,
        duration: f32,
        source_start: f32,
    },
}

struct Studio {
    /// Envelopes, keyed by the four things they are computed from. A move
    /// changes none of them, and a publish happens on every frame of one —
    /// without this, dragging a clip rebuilds a few kilobytes of path string
    /// per audio clip per frame for a shape that did not change.
    waves: RefCell<std::collections::HashMap<String, Rc<str>>>,
    timelines: Vec<TimelineDoc>,
    active: usize,
    selection: Vec<String>,
    playhead: f32,
    scroll_left: f32,
    seconds_per_pixel: f32,
    frame_rate: f32,
    tool: TimelineTool,
    snap: bool,
    /// Index into the monitor's output list, and into its quality list. The
    /// output is a property of the project rather than of the view — it is
    /// what gets exported — but nothing else reads it yet.
    ratio: usize,
    /// 0 Full, 1 Half, 2 Quarter. Half by default, as the reference opens.
    quality: usize,
    playing: bool,
    /// One clip, held for Paste. A real clipboard is the system's and holds a
    /// serialised edit; this is the seam that becomes one.
    clipboard: Option<ClipDoc>,
    /// The two sheets. Held with the rest of the state because what they show
    /// is the project, and because only one of them can be up at a time.
    export: ExportState,
    settings: SettingsState,
    transcribers: Vec<ModelState>,
    voices: Vec<ModelState>,
    /// The A/V tray menu, built like the clip menu and shown the same way.
    av_token: i32,
    /// Which title-bar menu is open, or -1, and the token that shows it.
    open_menu: i32,
    menu_bar_token: i32,
    /// The clip the context menu was opened on. Held separately from the
    /// selection because the menu outlives the press that opened it.
    menu_target: Option<String>,
    menu_token: i32,
    gesture: Gesture,
    next_id: u32,
}

/// The three models the timeline publishes into, kept rather than rebuilt so a
/// republish is a `set_vec` and not a new model on every keystroke.
struct TimelineModels {
    tabs: Rc<VecModel<TimelineTabData>>,
    tracks: Rc<VecModel<TrackData>>,
    clips: Rc<VecModel<ClipData>>,
}

impl Studio {
    fn now(&self) -> &TimelineDoc {
        &self.timelines[self.active]
    }

    fn now_mut(&mut self) -> &mut TimelineDoc {
        &mut self.timelines[self.active]
    }

    /// The track a row index names. Rows count from the top of the panel and
    /// the model stores lanes from the bottom, so this is the one place the
    /// two orders meet.
    fn row_track(&self, row: i32) -> Option<&TrackDoc> {
        let tracks = &self.now().tracks;
        let count = tracks.len() as i32;
        if row < 0 || row >= count {
            return None;
        }
        tracks.get((count - 1 - row) as usize)
    }

    fn row_of(&self, track_id: &str) -> i32 {
        let tracks = &self.now().tracks;
        tracks
            .iter()
            .position(|track| track.id == track_id)
            .map(|index| tracks.len() as i32 - 1 - index as i32)
            .unwrap_or(0)
    }

    fn clip(&self, id: &str) -> Option<&ClipDoc> {
        self.now().clips.iter().find(|clip| clip.id == id)
    }

    fn mint(&mut self, prefix: &str) -> String {
        self.next_id += 1;
        format!("{prefix}{}", self.next_id)
    }

    /// The next lane's name. Numbered from the highest already in use and not
    /// from the count, which is the engine's rule: adding a lane after
    /// removing one should not hand out a name the project has seen before.
    fn next_track_name(&self) -> String {
        let highest = self
            .now()
            .tracks
            .iter()
            .filter_map(|track| track.name.rsplit(' ').next()?.parse::<u32>().ok())
            .max()
            .unwrap_or(0);
        format!("Track {}", highest + 1)
    }

    /// Whether a lane refuses to be edited.
    fn locked(&self, track_id: &str) -> bool {
        self.now()
            .tracks
            .iter()
            .any(|track| track.id == track_id && track.locked)
    }

    /// Seconds the project runs to, for Fit and for the scroll floor.
    fn duration(&self) -> f32 {
        self.now()
            .clips
            .iter()
            .fold(0.0_f32, |longest, clip| longest.max(clip.end()))
    }

    /// The reference's snapTime: clip edges, the playhead and zero all pull,
    /// and the nearest inside the threshold wins.
    fn snapped(&self, time: f32, threshold: f32, exclude: &str) -> f32 {
        if !self.snap {
            return time;
        }
        let mut best = time;
        let mut best_distance = threshold;
        let mut consider = |target: f32| {
            let distance = (target - time).abs();
            if distance < best_distance {
                best = target;
                best_distance = distance;
            }
        };
        consider(0.0);
        consider(self.playhead);
        for clip in &self.now().clips {
            if clip.id == exclude {
                continue;
            }
            consider(clip.start);
            consider(clip.end());
        }
        best
    }

    /// Why the selection cannot be merged, or None when it can. The reason is
    /// carried rather than a bare bool: a button that greys out without saying
    /// why leaves you guessing at the rule.
    fn merge_blocked(&self) -> Option<&'static str> {
        if self.selection.len() != 2 {
            return Some("Select two clips to merge");
        }
        let (Some(a), Some(b)) = (self.clip(&self.selection[0]), self.clip(&self.selection[1]))
        else {
            return Some("Select two clips to merge");
        };
        let (first, second) = if a.start <= b.start { (a, b) } else { (b, a) };
        if first.track != second.track {
            return Some("Both clips must be on one track");
        }
        if first.media != second.media || first.media.is_empty() {
            return Some("Both clips must come from one file");
        }
        if (second.start - first.end()).abs() > MIN_DURATION {
            return Some("The two clips must be touching");
        }
        if (second.source_start - (first.source_start + first.duration)).abs() > MIN_DURATION {
            return Some("The cut has material missing between them");
        }
        None
    }

    /// Sound to detach, or a title's words to speak — the reference only hangs
    /// the A/V menu in the tray when the selection has something to offer it.
    fn has_av_tools(&self) -> bool {
        self.selection.len() == 1
            && self
                .clip(&self.selection[0])
                .is_some_and(|clip| clip.kind != ClipKind::Image)
    }

    /// The memoised envelope for one clip.
    fn wave(&self, clip: &ClipDoc) -> Rc<str> {
        // Rounded into the key: the path has four decimal places, so changes
        // below a millisecond or a thousandth of a gain cannot move it.
        let key = format!(
            "{}|{:.3}|{:.3}|{:.3}",
            clip.media, clip.source_start, clip.duration, clip.volume
        );
        if let Some(cached) = self.waves.borrow().get(&key) {
            return cached.clone();
        }
        let built: Rc<str> = Rc::from(wave_path(
            &clip.media,
            clip.source_start,
            clip.duration,
            clip.volume,
        ));
        self.waves.borrow_mut().insert(key, built.clone());
        built
    }

    /// The selection, flattened for the inspector.
    ///
    /// Exactly one clip or nothing: a panel of numbers describing two clips at
    /// once can only lie, so a multiple selection reads as no selection —
    /// which is what puts the pane back on the project's details.
    fn selected(&self) -> SelectedClipData {
        let Some(clip) = self
            .selection
            .first()
            .filter(|_| self.selection.len() == 1)
            .and_then(|id| self.clip(id))
        else {
            return SelectedClipData::default();
        };
        let text = &clip.text;
        SelectedClipData {
            present: true,
            id: clip.id.as_str().into(),
            name: clip.name.as_str().into(),
            kind: clip.kind,
            duration: clip.duration,
            scale: clip.scale,
            offset_x: clip.offset_x,
            offset_y: clip.offset_y,
            rotation: clip.rotation,
            opacity: clip.opacity,
            volume: clip.volume,
            speed: clip.speed,
            preserve_pitch: clip.preserve_pitch,
            fade_in: clip.fade_in,
            fade_out: clip.fade_out,
            content: clip.text_body.as_str().into(),
            font_family: text.family.as_str().into(),
            font_size: text.size,
            font_weight: text.weight,
            italic: text.italic,
            fill: text.fill,
            fill_hex: hex_of(text.fill).into(),
            align: text.align,
            text_opacity: text.opacity,
            stroke_width: text.stroke_width,
            stroke: text.stroke,
            stroke_hex: hex_of(text.stroke).into(),
            shadow: text.shadow,
            plate: text.plate,
            plate_hex: hex_of(text.plate).into(),
            plated: text.plate.alpha() > 0,
            line_height: text.line_height,
            tracking: text.tracking,
        }
    }

    /// The right-click menu for the clip it was opened on.
    ///
    /// Rows are built here rather than in Slint for the reason the bin's
    /// filtering is: what belongs on the menu depends on the clip, and
    /// deciding that needs branching over the model. `speed`'s three options
    /// are a flat labelled group rather than a submenu — a Slint struct cannot
    /// hold an array, so a row cannot carry children.
    fn menu(&self) -> Vec<MenuItemData> {
        let Some(clip) = self.menu_target.as_ref().and_then(|id| self.clip(id)) else {
            return Vec::new();
        };
        let locked = self.locked(&clip.track);
        let straddled = clip.start < self.playhead && self.playhead < clip.end();

        let action = |id: &str, label: String, glyph: Glyph, shortcut: &str, enabled: bool| {
            MenuItemData {
                id: id.into(),
                label: label.into(),
                kind: MenuRow::Action,
                glyph,
                shortcut: shortcut.into(),
                enabled,
                danger: false,
                checkable: false,
                checked: false,
            }
        };
        let check = |id: &str, label: &str, shortcut: &str, on: bool, enabled: bool| {
            MenuItemData {
                id: id.into(),
                label: label.into(),
                kind: MenuRow::Action,
                glyph: Glyph::None,
                shortcut: shortcut.into(),
                enabled,
                danger: false,
                checkable: true,
                checked: on,
            }
        };
        let heading = |label: &str| MenuItemData {
            label: label.into(),
            kind: MenuRow::Label,
            ..Default::default()
        };
        let rule = || MenuItemData { kind: MenuRow::Separator, ..Default::default() };

        let mut rows = vec![
            heading(&clip.name),
            action("copy", "Copy".into(), Glyph::Copy, "⌘C", true),
            action("duplicate", "Duplicate".into(), Glyph::Plus, "⌘D", !locked),
            // Disabled rather than hidden: a menu whose rows move around
            // between openings has to be re-read every time.
            action("paste", "Paste".into(), Glyph::Plus, "⌘V", self.clipboard.is_some()),
            rule(),
            action("split", "Split at playhead".into(), Glyph::Split, "S", straddled && !locked),
            rule(),
            heading("SPEED"),
        ];
        for (id, rate) in [("speed-half", 0.5_f32), ("speed-one", 1.0), ("speed-two", 2.0)] {
            rows.push(check(
                id,
                &format!("{rate:.2}x"),
                "",
                (clip.speed - rate).abs() < 0.001,
                !locked,
            ));
        }
        rows.push(rule());
        // Mute is the gain, not a flag: there is one number that decides
        // whether a clip is heard, and a second one would have to agree with it.
        rows.push(check("mute", "Mute", "M", clip.volume <= 0.0, !locked && clip.kind != ClipKind::Image));
        rows.push(check("lock", "Lock track", "", locked, true));
        rows.push(rule());
        rows.push(MenuItemData {
            id: "delete".into(),
            label: "Delete".into(),
            kind: MenuRow::Action,
            glyph: Glyph::Trash,
            shortcut: "⌫".into(),
            enabled: !locked,
            danger: true,
            checkable: false,
            checked: false,
        });
        rows
    }

    /// What those rows add up to. Slint cannot sum a model, and the surface
    /// has to be given a height before it is shown.
    fn menu_height(rows: &[MenuItemData]) -> f32 {
        let metrics = |kind: MenuRow| match kind {
            MenuRow::Action => 26.0,
            MenuRow::Label => 24.0,
            MenuRow::Separator => 9.0,
        };
        rows.iter().map(|row| metrics(row.kind)).sum::<f32>() + 8.0
    }

    /// What one export tier would weigh, in bytes.
    fn export_size(&self, tier: usize) -> f32 {
        let (width, height) = EXPORT_SIZES[self.export.resolution.min(3)];
        let rate = EXPORT_RATES[self.export.rate.min(2)];
        let pixels = (width as f32 * height as f32) / (1920.0 * 1080.0);
        let video = EXPORT_TIERS[tier.min(2)] * 1_000_000.0 * pixels * (rate / 30.0);
        (video + AUDIO_BPS) * self.duration().max(1.0) / 8.0
    }

    fn export_data(&self) -> ExportData {
        let (width, height) = EXPORT_SIZES[self.export.resolution.min(3)];
        let rate = EXPORT_RATES[self.export.rate.min(2)];
        let clips = self.now().clips.len();
        let titles = self
            .now()
            .clips
            .iter()
            .filter(|clip| clip.kind == ClipKind::Text)
            .count();
        // The stage names follow the progress rather than being counted off:
        // the engine reports one number, and what it is busy with at that
        // number is a fact about the pipeline, not about the UI.
        let stage = if self.export.progress < 0.68 {
            "Rendering video"
        } else if self.export.progress < 0.88 {
            "Encoding audio"
        } else {
            "Finalising file"
        };

        ExportData {
            open: self.export.open,
            name: self.export.name.as_str().into(),
            path: format!("{}/{}.mp4", self.export.folder, self.export.name).into(),
            format: format!("{width} × {height} · {rate:.2} fps").into(),
            duration: {
                let whole = self.duration().max(0.0) as i32;
                format!("{}:{:02}", whole / 60, whole % 60).into()
            },
            contents: if titles > 0 {
                format!("{clips} clips · {titles} titles")
            } else {
                format!("{clips} clips")
            }
            .into(),
            resolution: self.export.resolution as i32,
            rate: self.export.rate as i32,
            quality: self.export.quality as i32,
            size_high: bytes(self.export_size(0)).into(),
            size_balanced: bytes(self.export_size(1)).into(),
            size_small: bytes(self.export_size(2)).into(),
            phase: self.export.phase,
            progress: self.export.progress,
            stage: stage.into(),
            // The rate is the simulation's: a real one comes off the engine.
            eta: eta((1.0 - self.export.progress) * 9.0).into(),
            message: self.export.message.as_str().into(),
            done_size: bytes(self.export_size(self.export.quality)).into(),
            empty: clips == 0,
        }
    }

    fn model_rows(models: &[ModelState]) -> Vec<ModelData> {
        models
            .iter()
            .map(|model| {
                let total = model.megabytes;
                let fetched = model.fetched.unwrap_or(0.0);
                ModelData {
                    id: model.id.as_str().into(),
                    name: model.name.as_str().into(),
                    note: model.note.as_str().into(),
                    size: format!("{total:.0} MB").into(),
                    accuracy: model.accuracy,
                    installed: model.installed,
                    active: model.active && model.installed,
                    downloading: model.fetched.is_some(),
                    progress: if total > 0.0 { fetched / total } else { 0.0 },
                    transferred: format!("{fetched:.0} MB of {total:.0} MB · 12 MB/s").into(),
                    eta: eta((total - fetched) / 12.0).into(),
                }
            })
            .collect()
    }

    /// The tray's A/V menu. What it offers depends on what is selected, which
    /// is why it is built here and not declared in the tray.
    fn av_menu(&self) -> Vec<MenuItemData> {
        let Some(clip) = self
            .selection
            .first()
            .filter(|_| self.selection.len() == 1)
            .and_then(|id| self.clip(id))
        else {
            return Vec::new();
        };

        let row = |id: &str, label: &str, glyph: Glyph, enabled: bool| MenuItemData {
            id: id.into(),
            label: label.into(),
            kind: MenuRow::Action,
            glyph,
            shortcut: SharedString::new(),
            enabled,
            danger: false,
            checkable: false,
            checked: false,
        };

        // A title's one tool is to speak its words; it has no sound to detach.
        if clip.kind == ClipKind::Text {
            return vec![row("speak", "Generate voice", Glyph::Volume, true)];
        }

        let has_sound = clip.kind != ClipKind::Image;
        let detached = self
            .now()
            .clips
            .iter()
            .any(|other| other.detached_from.as_deref() == Some(clip.id.as_str()));
        vec![
            row("captions", "Auto captions", Glyph::TextMark, has_sound),
            MenuItemData { kind: MenuRow::Separator, ..Default::default() },
            row(
                "detach",
                "Detach audio",
                Glyph::Waveform,
                clip.kind == ClipKind::Video && !detached,
            ),
            row(
                "reattach",
                "Reattach audio",
                Glyph::Merge,
                (clip.kind == ClipKind::Video && detached)
                    || (clip.kind == ClipKind::Audio && clip.detached_from.is_some()),
            ),
        ]
    }

    /// The File / Edit / View menus, following the reference's own lists.
    fn menu_bar(&self) -> Vec<MenuItemData> {
        let row = |id: &str, label: String, glyph: Glyph, shortcut: &str, enabled: bool| {
            MenuItemData {
                id: id.into(),
                label: label.into(),
                kind: MenuRow::Action,
                glyph,
                shortcut: shortcut.into(),
                enabled,
                danger: false,
                checkable: false,
                checked: false,
            }
        };
        let rule = || MenuItemData { kind: MenuRow::Separator, ..Default::default() };
        let selected = self.selection.len();
        let straddled = self.now().clips.iter().any(|clip| {
            clip.start + MIN_DURATION < self.playhead && self.playhead < clip.end() - MIN_DURATION
        });

        match self.open_menu {
            0 => vec![
                // Disabled rather than absent: a menu whose rows move between
                // openings has to be re-read every time.
                row("add-selected", "Add selected to timeline".into(), Glyph::Plus, "", false),
                row("save", "Save".into(), Glyph::Import, "⌘S", true),
                row("export", "Export…".into(), Glyph::Export, "", !self.now().clips.is_empty()),
                row("template", "Save as template…".into(), Glyph::Slot, "", true),
                row("speech", "Text to speech…".into(), Glyph::Volume, "", true),
                rule(),
                row("settings", "Settings…".into(), Glyph::Settings, "⌘,", true),
                rule(),
                row("close-project", "Close project".into(), Glyph::Import, "", true),
                MenuItemData {
                    id: "close-window".into(),
                    label: "Close window".into(),
                    kind: MenuRow::Action,
                    glyph: Glyph::Close,
                    shortcut: "⌘W".into(),
                    enabled: true,
                    danger: true,
                    checkable: false,
                    checked: false,
                },
            ],
            1 => vec![
                // Nothing in this tree records what it did, so neither of
                // these can ever be live. They are here because a menu that
                // omits Undo is a menu that looks broken.
                row("undo", "Undo".into(), Glyph::ChevronUp, "⌘Z", false),
                row("redo", "Redo".into(), Glyph::ChevronDown, "⇧⌘Z", false),
                rule(),
                row("split", "Split at playhead".into(), Glyph::Razor, "⌘B", straddled),
                MenuItemData {
                    id: "delete".into(),
                    label: if selected > 1 {
                        format!("Delete {selected} clips")
                    } else {
                        "Delete clip".into()
                    }
                    .into(),
                    kind: MenuRow::Action,
                    glyph: Glyph::Trash,
                    shortcut: "⌫".into(),
                    enabled: selected > 0,
                    danger: true,
                    checkable: false,
                    checked: false,
                },
                rule(),
                MenuItemData {
                    id: "snap".into(),
                    label: "Snap to edges".into(),
                    kind: MenuRow::Action,
                    glyph: Glyph::None,
                    shortcut: "N".into(),
                    enabled: true,
                    danger: false,
                    checkable: true,
                    checked: self.snap,
                },
            ],
            2 => vec![
                row("zoom-in", "Zoom in".into(), Glyph::Plus, "+", true),
                row("zoom-out", "Zoom out".into(), Glyph::Minus, "-", true),
                rule(),
                row("start", "Go to start".into(), Glyph::SkipBack, "Home", true),
                row("end", "Go to end".into(), Glyph::SkipForward, "End", true),
            ],
            _ => Vec::new(),
        }
    }

    fn publish(&self, app: &App, models: &TimelineModels) {
        models.tabs.set_vec(
            self.timelines
                .iter()
                .map(|timeline| TimelineTabData {
                    id: timeline.id.as_str().into(),
                    name: timeline.name.as_str().into(),
                })
                .collect::<Vec<_>>(),
        );

        // Reversed on the way out: top-most lane first is what the panel draws.
        models.tracks.set_vec(
            self.now()
                .tracks
                .iter()
                .rev()
                .map(|track| TrackData {
                    id: track.id.as_str().into(),
                    name: track.name.as_str().into(),
                    visible: track.visible,
                    muted: track.muted,
                    locked: track.locked,
                })
                .collect::<Vec<_>>(),
        );

        models.clips.set_vec(
            self.now()
                .clips
                .iter()
                .map(|clip| ClipData {
                    id: clip.id.as_str().into(),
                    name: clip.name.as_str().into(),
                    kind: clip.kind,
                    row: self.row_of(&clip.track),
                    start: clip.start,
                    duration: clip.duration,
                    selected: self.selection.iter().any(|id| id == &clip.id),
                    fx: clip.fx,
                    transition_in: clip.transition_in,
                    fade_in: clip.fade_in,
                    fade_out: clip.fade_out,
                    volume: clip.volume,
                    text_body: clip.text_body.as_str().into(),
                    wave: if clip.kind == ClipKind::Audio {
                        self.wave(clip).as_ref().into()
                    } else {
                        SharedString::new()
                    },
                })
                .collect::<Vec<_>>(),
        );

        // What is under the playhead. The topmost picture wins, the way the
        // compositor stacks them — a title over footage shows the title.
        let showing = self
            .now()
            .clips
            .iter()
            .filter(|clip| {
                clip.kind != ClipKind::Audio
                    && clip.start <= self.playhead
                    && self.playhead < clip.end()
            })
            .max_by_key(|clip| self.row_of(&clip.track) * -1);
        app.set_has_picture(showing.is_some());
        app.set_preview_clip_name(
            showing.map(|clip| clip.name.as_str()).unwrap_or_default().into(),
        );
        app.set_preview_duration(self.duration());
        let (width, height) = OUTPUTS[self.ratio.min(OUTPUTS.len() - 1)];
        app.set_output_width(width);
        app.set_output_height(height);
        app.set_ratio_index(self.ratio as i32);
        app.set_quality_index(self.quality as i32);
        app.set_playing(self.playing);

        let rows = self.menu();
        app.set_menu_height(Studio::menu_height(&rows));
        app.set_menu_items(ModelRc::from(Rc::new(VecModel::from(rows))));
        app.set_menu_token(self.menu_token);

        app.set_export(self.export_data());
        app.set_settings(SettingsData {
            open: self.settings.open,
            tab: self.settings.tab,
            language: self.settings.language as i32,
            transcribe_language: self.settings.transcribe_language,
            disk: {
                let on_disk: f32 = self
                    .transcribers
                    .iter()
                    .chain(self.voices.iter())
                    .filter(|model| model.installed)
                    .map(|model| model.megabytes)
                    .sum();
                let count = self
                    .transcribers
                    .iter()
                    .chain(self.voices.iter())
                    .filter(|model| model.installed)
                    .count();
                format!("{count} installed · {on_disk:.0} MB on disk").into()
            },
            version: "0.1.0".into(),
            engine: "wolfcut-engine · ffmpeg 7.1".into(),
        });
        app.set_transcribers(ModelRc::from(Rc::new(VecModel::from(Studio::model_rows(
            &self.transcribers,
        )))));
        app.set_voices(ModelRc::from(Rc::new(VecModel::from(Studio::model_rows(&self.voices)))));

        let av = self.av_menu();
        app.set_av_height(Studio::menu_height(&av));
        app.set_av_items(ModelRc::from(Rc::new(VecModel::from(av))));
        app.set_av_token(self.av_token);

        let bar = self.menu_bar();
        app.set_app_menu_height(Studio::menu_height(&bar));
        app.set_app_menu_items(ModelRc::from(Rc::new(VecModel::from(bar))));
        app.set_app_menu_token(self.menu_bar_token);
        app.set_open_menu(self.open_menu);

        app.set_selected_clip(self.selected());
        app.set_timeline_current_tab(self.active as i32);
        app.set_playhead(self.playhead);
        app.set_scroll_left(self.scroll_left);
        app.set_seconds_per_pixel(self.seconds_per_pixel);
        app.set_frame_rate(self.frame_rate);
        app.set_tool(self.tool);
        app.set_snap(self.snap);
        app.set_selected_count(self.selection.len() as i32);
        app.set_has_av_tools(self.has_av_tools());
        app.set_merge_blocked_because(match self.merge_blocked() {
            Some(reason) => reason.into(),
            None => SharedString::new(),
        });
    }
}

/// The audio envelope, as SVG path commands in a 1x1 box.
///
/// Columns, not a curve. The reference fills one rectangle per pixel of clip
/// width — `context.rect(x + column, top, 1, ...)` for every column, then one
/// fill — so its waveform is a stepped silhouette with a flat top on every
/// column. Drawing the same peaks as a polyline gives a smooth, rounded shape
/// that reads as a graph of something rather than as audio.
///
/// There is no decoder in this tree, so the peaks are synthesised from the
/// media id — deterministic, so a clip keeps its shape across a republish, and
/// two clips cut from one file agree where they were cut. Swap this for the
/// real buckets the day something decodes; the path it returns is the whole
/// contract.
///
/// Normalised rather than drawn in pixels so a zoom costs nothing: the Path
/// that renders it stretches the box onto the clip's current width.
fn wave_path(media: &str, source_start: f32, duration: f32, gain: f32) -> String {
    /// Columns across the clip. The reference gets one per pixel because it
    /// redraws at the clip's current width; this is drawn once and stretched,
    /// so the count is fixed — enough that the steps read as columns and not
    /// as a bar chart, few enough that the string stays a few kilobytes.
    const COLUMNS: usize = 128;
    /// Silence still draws a sliver, the way the reference's `max(1, ...)`
    /// keeps a one-pixel line rather than a gap in the middle of a clip.
    const FLOOR: f32 = 0.012;

    if duration <= 0.0 {
        return String::new();
    }

    // xorshift32 over a seed folded from the id, so no rand dependency and no
    // shared state between clips.
    let mut seed = media
        .bytes()
        .fold(0x2545_f491_u32, |hash, byte| (hash ^ byte as u32).wrapping_mul(16_777_619))
        | 1;
    let mut random = move || {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        (seed >> 8) as f32 / (1 << 24) as f32
    };

    // Drawn amplitude follows the clip's gain, so turning a clip up makes its
    // waveform visibly taller. Clamped, or a boosted clip would bleed into the
    // lane above.
    let gain = gain.max(0.0);
    let mut path = String::with_capacity(COLUMNS * 56);

    for column in 0..COLUMNS {
        let left = column as f32 / COLUMNS as f32;
        let right = (column + 1) as f32 / COLUMNS as f32;
        // A slow syllabic swell under the noise, so it reads as speech rather
        // than as static. Phase follows the in-point, which is what makes two
        // clips cut from one file line up where they were cut.
        let at = source_start + (column as f32 / COLUMNS as f32) * duration;
        let envelope = 0.35 + 0.3 * (at * 2.3).sin().abs() + 0.25 * random();
        let amplitude = ((envelope * gain).clamp(0.0, 1.0) * 0.48).max(FLOOR);
        let (top, bottom) = (0.5 - amplitude, 0.5 + amplitude);

        // Columns butt up against each other rather than leaving a gap: the
        // reference's are contiguous, which is what makes a loud passage read
        // as a solid block instead of a comb.
        path.push_str(&format!(
            "M {left:.4} {top:.4} L {right:.4} {top:.4} \
             L {right:.4} {bottom:.4} L {left:.4} {bottom:.4} Z "
        ));
    }

    path
}

fn clip(
    id: &str,
    name: &str,
    kind: ClipKind,
    track: &str,
    media: &str,
    start: f32,
    duration: f32,
) -> ClipDoc {
    ClipDoc {
        id: id.into(),
        name: name.into(),
        kind,
        track: track.into(),
        media: media.into(),
        start,
        duration,
        source_start: 0.0,
        scale: 1.0,
        offset_x: 0.0,
        offset_y: 0.0,
        rotation: 0.0,
        opacity: 1.0,
        speed: 1.0,
        preserve_pitch: true,
        volume: 1.0,
        fade_in: 0.0,
        fade_out: 0.0,
        fx: false,
        transition_in: false,
        text_body: String::new(),
        detached_from: None,
        text: TextStyleDoc::default(),
    }
}

/// A cut the size of a real one, so the lanes are exercised at the zooms and
/// widths a splitter drag actually produces.
fn demo_studio() -> Studio {
    let mut voice = clip("c1", "intro.mp3", ClipKind::Audio, "T1", "m1", 0.0, 3.4);
    voice.fade_in = 0.4;
    voice.fade_out = 0.6;
    let mut line = clip("c2", "line-02.mp3", ClipKind::Audio, "T1", "m13", 4.2, 1.9);
    line.fade_out = 0.3;
    let mut out = clip("c3", "outro.mp3", ClipKind::Audio, "T1", "m17", 7.0, 5.2);
    out.fade_in = 0.5;

    let mut wide = clip("c4", "0001-0036.mp4", ClipKind::Video, "T2", "m2", 0.0, 1.2);
    wide.fx = true;
    let mut mid = clip("c5", "0036-0072.mp4", ClipKind::Video, "T2", "m3", 1.2, 1.2);
    mid.transition_in = true;
    let long = clip("c6", "0072-0134.mp4", ClipKind::Video, "T2", "m4", 2.4, 2.1);
    let mut close = clip("c7", "0134-0182.mp4", ClipKind::Video, "T2", "m5", 5.1, 1.6);
    close.transition_in = true;
    close.fx = true;
    // Punched in a little, so the Transform group opens on something other
    // than four defaults the first time a video clip is selected.
    close.scale = 1.25;
    close.offset_y = -0.06;
    let tail = clip("c8", "0232-0322.mp4", ClipKind::Video, "T2", "m6", 8.2, 3.0);

    let mut title = clip("c9", "Title", ClipKind::Text, "T3", "", 0.6, 2.2);
    title.text_body = "WolfCut — a cut worth keeping".into();
    title.text = TextStyleDoc {
        family: "Synonym".into(),
        size: 0.11,
        weight: 600.0,
        ..Default::default()
    };
    let mut lower = clip("c10", "Lower third", ClipKind::Text, "T3", "", 5.4, 2.0);
    lower.text_body = "Chapter one".into();
    lower.text = TextStyleDoc {
        size: 0.06,
        weight: 500.0,
        align: TextAlignment::Left,
        fill: slint::Color::from_rgb_u8(0xcb, 0xf5, 0x3f),
        plate: slint::Color::from_argb_u8(0xcc, 0, 0, 0),
        ..Default::default()
    };
    // Lower thirds sit low in the frame, which is the whole of what makes them
    // lower thirds.
    lower.offset_y = 0.3;

    let timeline = TimelineDoc {
        id: "TL1".into(),
        name: "Timeline 1".into(),
        // Bottom-most first: T1 is the floor of the stack, T3 the top.
        tracks: vec![
            TrackDoc { id: "T1".into(), name: "Track 1".into(), visible: true, muted: false, locked: false },
            TrackDoc { id: "T2".into(), name: "Track 2".into(), visible: true, muted: false, locked: false },
            TrackDoc { id: "T3".into(), name: "Track 3".into(), visible: true, muted: false, locked: false },
        ],
        clips: vec![voice, line, out, wide, mid, long, close, tail, title, lower],
    };

    Studio {
        waves: RefCell::new(std::collections::HashMap::new()),
        timelines: vec![
            timeline,
            TimelineDoc {
                id: "TL2".into(),
                name: "Rough cut".into(),
                tracks: vec![
                    TrackDoc { id: "T4".into(), name: "Track 1".into(), visible: true, muted: false, locked: false },
                    TrackDoc { id: "T5".into(), name: "Track 2".into(), visible: true, muted: false, locked: false },
                ],
                clips: vec![clip("c11", "0326-0452.mp4", ClipKind::Video, "T5", "m7", 0.0, 4.2)],
            },
        ],
        active: 0,
        selection: Vec::new(),
        playhead: 2.0,
        scroll_left: 0.0,
        // ~20px a second: a ten-second cut fits a pane at its default width.
        seconds_per_pixel: 0.05,
        frame_rate: 30.0,
        tool: TimelineTool::Select,
        snap: true,
        ratio: 0,
        quality: 1,
        playing: false,
        clipboard: None,
        export: ExportState::default(),
        settings: SettingsState::default(),
        transcribers: demo_transcribers(),
        voices: demo_voices(),
        av_token: 0,
        open_menu: -1,
        menu_bar_token: 0,
        menu_target: None,
        menu_token: 0,
        gesture: Gesture::None,
        next_id: 100,
    }
}

fn main() -> Result<(), slint::PlatformError> {
    // The custom title bar. On macOS the native bar is hidden and the traffic
    // lights are overlaid on the strip the UI draws — the winit spelling of
    // the Tauri build's `titleBarStyle: "Overlay"`. Other platforms keep
    // their decorations for now; the reference goes undecorated with its own
    // window buttons on Windows, which is a separate port.
    #[cfg(target_os = "macos")]
    {
        use slint::winit_030::winit::platform::macos::WindowAttributesExtMacOS;
        slint::BackendSelector::new()
            .backend_name("winit".into())
            .with_winit_window_attributes_hook(|attributes| {
                attributes
                    .with_titlebar_transparent(true)
                    .with_title_hidden(true)
                    .with_fullsize_content_view(true)
            })
            .select()?;
    }

    let app = App::new()?;
    app.set_macos(cfg!(target_os = "macos"));

    // The strip's drag region and double-click. Only the winit window can do
    // either; the scene graph forwards the gestures here.
    app.on_titlebar_begin_drag({
        let weak = app.as_weak();
        move || {
            use slint::winit_030::WinitWindowAccessor;
            if let Some(app) = weak.upgrade() {
                app.window().with_winit_window(|window| {
                    let _ = window.drag_window();
                });
            }
        }
    });

    app.on_titlebar_toggle_maximize({
        let weak = app.as_weak();
        move || {
            use slint::winit_030::WinitWindowAccessor;
            if let Some(app) = weak.upgrade() {
                app.window().with_winit_window(|window| {
                    window.set_maximized(!window.is_maximized());
                });
            }
        }
    });

    // --- effect lists ----------------------------------------------------
    let video = Rc::new(VecModel::from(vec![
        EffectData { id: 1, name: SharedString::from("Lumetri Color"), audio: false },
        EffectData { id: 2, name: SharedString::from("Motion Blur"), audio: false },
        EffectData { id: 3, name: SharedString::from("Glow"), audio: false },
    ]));
    let audio = Rc::new(VecModel::from(vec![
        EffectData { id: 4, name: SharedString::from("EQ"), audio: true },
        EffectData { id: 5, name: SharedString::from("Denoiser"), audio: true },
    ]));

    app.set_video_effects(ModelRc::from(video.clone()));
    app.set_audio_effects(ModelRc::from(audio.clone()));

    let next_id = Rc::new(Cell::new(6));

    app.on_add_effect({
        let video = video.clone();
        let audio = audio.clone();
        let next_id = next_id.clone();
        move |is_audio| {
            let list = if is_audio { &audio } else { &video };
            let id = next_id.get();
            next_id.set(id + 1);
            let name = POOL[list.row_count() % POOL.len()];
            list.push(EffectData {
                id,
                name: SharedString::from(name),
                audio: is_audio,
            });
        }
    });

    app.on_remove_effect({
        let video = video.clone();
        let audio = audio.clone();
        move |id| {
            for list in [&video, &audio] {
                if let Some(row) = list.iter().position(|effect| effect.id == id) {
                    list.remove(row);
                    return;
                }
            }
        }
    });

    // --- the bin ---------------------------------------------------------
    let library = Rc::new(Library::new(demo_library()));
    let view = Rc::new(VecModel::<MediaItemData>::default());
    app.set_media(ModelRc::from(view.clone()));
    library.publish(&app, &view);

    // Every one of these ends in the same republish, so there is one place
    // where the panel's idea of the bin can go wrong.
    app.on_media_filter_changed({
        let weak = app.as_weak();
        let library = library.clone();
        let view = view.clone();
        move |filter| {
            let Some(app) = weak.upgrade() else { return };
            library.filter.set(filter);
            library.publish(&app, &view);
        }
    });

    app.on_media_select({
        let weak = app.as_weak();
        let library = library.clone();
        let view = view.clone();
        move |id, additive| {
            let Some(app) = weak.upgrade() else { return };
            for item in library.items.borrow_mut().iter_mut() {
                if item.id == id {
                    // A modifier toggles this one and leaves the rest alone; a
                    // plain click makes it the whole selection.
                    item.selected = !additive || !item.selected;
                } else if !additive {
                    item.selected = false;
                }
            }
            library.publish(&app, &view);
        }
    });

    app.on_media_clear_selection({
        let weak = app.as_weak();
        let library = library.clone();
        let view = view.clone();
        move || {
            let Some(app) = weak.upgrade() else { return };
            for item in library.items.borrow_mut().iter_mut() {
                item.selected = false;
            }
            library.publish(&app, &view);
        }
    });

    app.on_media_remove({
        let weak = app.as_weak();
        let library = library.clone();
        let view = view.clone();
        move |id| {
            let Some(app) = weak.upgrade() else { return };
            library.items.borrow_mut().retain(|item| item.id != id);
            library.publish(&app, &view);
        }
    });

    app.on_media_remove_selected({
        let weak = app.as_weak();
        let library = library.clone();
        let view = view.clone();
        move || {
            let Some(app) = weak.upgrade() else { return };
            library.items.borrow_mut().retain(|item| !item.selected);
            library.publish(&app, &view);
        }
    });

    // Both ends of these are unbuilt: there is no timeline to place a clip on
    // and no file picker in this crate — the reference opens Tauri's, and
    // reaching for a native dialog here is a dependency decision, not a
    // detail of the panel. The callbacks exist so the panel is wired to
    // something the day either lands.
    app.on_media_activate(|_id| {});
    app.on_import_media(|| {});


    // --- the timeline ----------------------------------------------------
    //
    // Every handler below ends in the same publish, for the reason the bin's
    // do: one path that always produces a consistent panel is worth more than
    // the row-level updates it could be split into.
    let studio = Rc::new(RefCell::new(demo_studio()));
    let timeline_models = Rc::new(TimelineModels {
        tabs: Rc::new(VecModel::default()),
        tracks: Rc::new(VecModel::default()),
        clips: Rc::new(VecModel::default()),
    });
    app.set_timeline_tabs(ModelRc::from(timeline_models.tabs.clone()));
    app.set_tracks(ModelRc::from(timeline_models.tracks.clone()));
    app.set_clips(ModelRc::from(timeline_models.clips.clone()));

    // Mutate, then republish. Handed the weak handle rather than the app so a
    // callback outliving the window is a no-op instead of a panic.
    macro_rules! on_timeline {
        (|$state:ident $(, $arg:ident : $ty:ty)*| $body:block) => {{
            let weak = app.as_weak();
            let studio = studio.clone();
            let models = timeline_models.clone();
            move |$($arg : $ty),*| {
                let Some(app) = weak.upgrade() else { return };
                {
                    let mut $state = studio.borrow_mut();
                    $body
                }
                studio.borrow().publish(&app, &models);
            }
        }};
    }

    // ── tabs ──
    app.on_tab_selected(on_timeline!(|state, index: i32| {
        if index >= 0 && (index as usize) < state.timelines.len() {
            state.active = index as usize;
            // A selection is a set of clip ids on *this* timeline; carrying it
            // across would leave the tray counting clips nobody can see.
            state.selection.clear();
        }
    }));

    app.on_tab_renamed(on_timeline!(|state, index: i32, name: SharedString| {
        let trimmed = name.trim().to_string();
        // Renames to whitespace are ignored, so a tab is never blank.
        if !trimmed.is_empty() {
            if let Some(timeline) = state.timelines.get_mut(index as usize) {
                timeline.name = trimmed;
            }
        }
    }));

    app.on_tab_added(on_timeline!(|state| {
        let id = state.mint("TL");
        let track = state.mint("T");
        let number = state.timelines.len() + 1;
        state.timelines.push(TimelineDoc {
            id,
            name: format!("Timeline {number}"),
            tracks: vec![TrackDoc {
                id: track,
                name: "Track 1".into(),
                visible: true,
                muted: false,
                locked: false,
            }],
            clips: Vec::new(),
        });
        state.active = state.timelines.len() - 1;
        state.selection.clear();
    }));

    // Deleting a timeline throws away every clip on it. The reference asks
    // first, through a confirm dialog this tree has not grown yet — so the
    // floor of one timeline is enforced and the confirm is the gap.
    app.on_tab_close_requested(on_timeline!(|state, index: i32| {
        if state.timelines.len() > 1 && (index as usize) < state.timelines.len() {
            state.timelines.remove(index as usize);
            state.active = state.active.min(state.timelines.len() - 1);
            state.selection.clear();
        }
    }));

    // ── the tray ──
    app.on_tool_changed(on_timeline!(|state, tool: TimelineTool| {
        state.tool = tool;
    }));

    app.on_snap_changed(on_timeline!(|state, snap: bool| {
        state.snap = snap;
    }));

    app.on_add_track(on_timeline!(|state| {
        let id = state.mint("T");
        let name = state.next_track_name();
        // Pushed, not inserted: the model runs bottom-up, so the end of the
        // list is the top of the stack — which is where a new lane belongs.
        state.now_mut().tracks.push(TrackDoc {
            id,
            name,
            visible: true,
            muted: false,
            locked: false,
        });
    }));

    app.on_delete_selected(on_timeline!(|state| {
        let doomed = state.selection.clone();
        state.now_mut().clips.retain(|clip| !doomed.contains(&clip.id));
        state.selection.clear();
    }));

    // Split at the playhead: every selected clip the playhead runs through, or
    // every clip at all when nothing is selected — which is what a split with
    // no selection means in an editor.
    app.on_split(on_timeline!(|state| {
        let at = state.playhead;
        let selection = state.selection.clone();
        let victims: Vec<String> = state
            .now()
            .clips
            .iter()
            .filter(|clip| {
                clip.start + MIN_DURATION < at
                    && at < clip.end() - MIN_DURATION
                    && (selection.is_empty() || selection.contains(&clip.id))
                    && !state.locked(&clip.track)
            })
            .map(|clip| clip.id.clone())
            .collect();

        for victim in victims {
            let Some(index) = state.now().clips.iter().position(|clip| clip.id == victim) else {
                continue;
            };
            let source = state.now().clips[index].clone();
            let new_id = state.mint("c");
            let head_duration = at - source.start;

            // The head keeps the id, the way the reference's split does, so a
            // command naming the clip still names something afterwards. The
            // ramps do not survive the cut: a fade-out belongs to the end of
            // the material, and the head no longer has one.
            let mut tail = source.clone();
            tail.id = new_id;
            tail.start = at;
            tail.duration = source.duration - head_duration;
            tail.source_start = source.source_start + head_duration;
            tail.fade_in = 0.0;
            tail.transition_in = false;

            let head = &mut state.now_mut().clips[index];
            head.duration = head_duration;
            head.fade_out = 0.0;
            state.now_mut().clips.push(tail);
        }
    }));

    app.on_merge(on_timeline!(|state| {
        if state.merge_blocked().is_some() {
            return;
        }
        let (a, b) = (state.selection[0].clone(), state.selection[1].clone());
        let (Some(first), Some(second)) = (
            state.now().clips.iter().position(|clip| clip.id == a),
            state.now().clips.iter().position(|clip| clip.id == b),
        ) else {
            return;
        };
        let (head, tail) = if state.now().clips[first].start <= state.now().clips[second].start {
            (first, second)
        } else {
            (second, first)
        };
        let tail_clip = state.now().clips[tail].clone();
        let head_clip = &mut state.now_mut().clips[head];
        head_clip.duration = tail_clip.end() - head_clip.start;
        head_clip.fade_out = tail_clip.fade_out;
        let kept = head_clip.id.clone();
        state.now_mut().clips.remove(tail);
        state.selection = vec![kept];
    }));

    // ── the view ──
    app.on_scrubbed(on_timeline!(|state, seconds: f32| {
        state.playhead = seconds.max(0.0);
    }));

    app.on_scrolled(on_timeline!(|state, seconds: f32| {
        state.scroll_left = seconds.max(0.0);
    }));

    app.on_zoom(on_timeline!(|state, factor: f32, anchor: f32| {
        let before = state.seconds_per_pixel;
        // Floored at a frame across two pixels and capped at ten minutes to
        // the pane, which is as far either way as the ruler stays legible.
        let after = (before * factor).clamp(0.000_5, 1.5);
        state.seconds_per_pixel = after;
        // Keep the moment under the pointer where it is. A press has no
        // pointer, and passes -1 to mean "hold the left edge".
        if anchor >= 0.0 {
            state.scroll_left = (anchor - (anchor - state.scroll_left) * (after / before)).max(0.0);
        }
    }));

    app.on_zoom_to_fit(on_timeline!(|state, width: f32| {
        // A little air past the end, so the last clip is not flush against the
        // right edge, and a floor so an empty timeline does not divide by zero.
        let span = state.duration().max(1.0) * 1.05;
        if width > 1.0 {
            state.seconds_per_pixel = (span / width).clamp(0.000_5, 1.5);
            state.scroll_left = 0.0;
        }
    }));

    // ── lanes ──
    app.on_track_flag_changed(on_timeline!(
        |state, row: i32, visible: bool, muted: bool, locked: bool| {
            let Some(id) = state.row_track(row).map(|track| track.id.clone()) else { return };
            if let Some(track) = state.now_mut().tracks.iter_mut().find(|track| track.id == id) {
                track.visible = visible;
                track.muted = muted;
                track.locked = locked;
            }
            // Locking a lane drops whatever was selected on it, so the tray
            // cannot offer to delete clips that no longer answer to it.
            if locked {
                let doomed: Vec<String> = state
                    .now()
                    .clips
                    .iter()
                    .filter(|clip| clip.track == id)
                    .map(|clip| clip.id.clone())
                    .collect();
                state.selection.retain(|held| !doomed.contains(held));
            }
        }
    ));

    app.on_track_renamed(on_timeline!(|state, row: i32, name: SharedString| {
        let trimmed = name.trim().to_string();
        if trimmed.is_empty() {
            return;
        }
        let Some(id) = state.row_track(row).map(|track| track.id.clone()) else { return };
        if let Some(track) = state.now_mut().tracks.iter_mut().find(|track| track.id == id) {
            track.name = trimmed;
        }
    }));

    // Removing a lane takes its clips with it, and keeps a floor of one.
    app.on_track_removed(on_timeline!(|state, row: i32| {
        if state.now().tracks.len() <= 1 {
            return;
        }
        let Some(id) = state.row_track(row).map(|track| track.id.clone()) else { return };
        state.now_mut().tracks.retain(|track| track.id != id);
        state.now_mut().clips.retain(|clip| clip.track != id);
        let survivors: Vec<String> =
            state.now().clips.iter().map(|clip| clip.id.clone()).collect();
        state.selection.retain(|id| survivors.contains(id));
    }));

    // ── the gestures ──
    //
    // A press resolves the selection before anything moves, so a drag that
    // starts on an already-selected clip carries the whole set rather than
    // collapsing to the one clip touched.
    app.on_clip_pressed(on_timeline!(|state, id: SharedString, additive: bool, edge: i32| {
        let id = id.to_string();
        let Some(clip) = state.clip(&id).cloned() else { return };
        // A locked lane takes no presses at all — not even to select. Half a
        // lock, where a clip can still be picked up and then deleted from the
        // tray, is worse than none.
        if state.locked(&clip.track) {
            return;
        }
        let already = state.selection.contains(&id);

        state.selection = if additive {
            if already {
                state.selection.iter().filter(|held| *held != &id).cloned().collect()
            } else {
                let mut next = state.selection.clone();
                next.push(id.clone());
                next
            }
        } else if already {
            state.selection.clone()
        } else {
            vec![id.clone()]
        };

        // An edge only trims while it is the one thing selected: dragging the
        // edge of a multiple selection is a move of the set, not a trim.
        if edge >= 0 && state.selection.len() <= 1 {
            state.gesture = Gesture::Trim {
                clip: id,
                edge: if edge == 0 { Edge::Start } else { Edge::End },
                start: clip.start,
                duration: clip.duration,
                source_start: clip.source_start,
            };
            return;
        }

        let moving = if state.selection.contains(&id) {
            state.selection.clone()
        } else {
            vec![id.clone()]
        };
        let origins = moving
            .iter()
            .filter_map(|clip_id| {
                let clip = state.clip(clip_id)?;
                Some(MoveOrigin {
                    clip: clip.id.clone(),
                    start: clip.start,
                    row: state.row_of(&clip.track),
                })
            })
            .collect();
        state.gesture = Gesture::Move { primary: id, origins };
    }));

    app.on_clip_dragged(on_timeline!(|state, seconds: f32, rows: i32| {
        // Lifted out rather than matched in place: every arm goes on to mutate
        // the clips, which cannot happen while the gesture is borrowed out of
        // the same struct. It goes back at the end, so a drag survives.
        let gesture = std::mem::replace(&mut state.gesture, Gesture::None);
        match &gesture {
            Gesture::Move { primary, origins } => {
                let Some(anchor) = origins.iter().find(|origin| &origin.clip == primary) else {
                    return;
                };
                // Only the grabbed clip snaps; the rest keep their offset from
                // it, so the shape of a multiple selection survives exactly.
                let threshold = 8.0 * state.seconds_per_pixel;
                let snapped = state.snapped(anchor.start + seconds, threshold, primary);
                let shift = snapped - anchor.start;

                let lanes = state.now().tracks.len() as i32;
                let moves: Vec<(String, f32, Option<String>)> = origins
                    .iter()
                    .map(|origin| {
                        let row = (origin.row + rows).clamp(0, lanes - 1);
                        // A locked lane refuses the drop: the clip still moves
                        // in time, it just stays on the lane it came from. The
                        // reference does the same for an unknown track id.
                        let onto = state
                            .row_track(row)
                            .filter(|track| !track.locked)
                            .map(|track| track.id.clone());
                        (origin.clip.clone(), (origin.start + shift).max(0.0), onto)
                    })
                    .collect();

                for (id, start, track) in moves {
                    if let Some(clip) = state.now_mut().clips.iter_mut().find(|clip| clip.id == id)
                    {
                        clip.start = start;
                        if let Some(track) = track {
                            clip.track = track;
                        }
                    }
                }
            }
            Gesture::Trim { clip, edge, start, duration, source_start } => {
                let (id, edge) = (clip.clone(), *edge);
                let (start, duration, source_start) = (*start, *duration, *source_start);
                let threshold = 8.0 * state.seconds_per_pixel;

                if edge == Edge::Start {
                    // The head cannot pass the tail, and cannot pull material
                    // out of a file that has none before the in-point.
                    let wanted = state.snapped(start + seconds, threshold, &id);
                    let limit = start + duration - MIN_DURATION;
                    let at = wanted.clamp((start - source_start).max(0.0), limit);
                    let delta = at - start;
                    if let Some(clip) = state.now_mut().clips.iter_mut().find(|c| c.id == id) {
                        clip.start = at;
                        clip.duration = duration - delta;
                        clip.source_start = source_start + delta;
                    }
                } else {
                    let wanted = state.snapped(start + duration + seconds, threshold, &id);
                    let at = wanted.max(start + MIN_DURATION);
                    if let Some(clip) = state.now_mut().clips.iter_mut().find(|c| c.id == id) {
                        clip.duration = at - start;
                    }
                }
            }
            Gesture::None => {}
        }
        state.gesture = gesture;
    }));

    // Releasing is what would make a move or a trim real: the reference echoes
    // it locally and turns the whole gesture into one undoable command here.
    // There is no command stack in this tree, so this only ends the gesture.
    app.on_clip_released(on_timeline!(|state| {
        state.gesture = Gesture::None;
    }));

    app.on_razored(on_timeline!(|state, id: SharedString, seconds: f32| {
        let id = id.to_string();
        let Some(index) = state.now().clips.iter().position(|clip| clip.id == id) else { return };
        let source = state.now().clips[index].clone();
        if state.locked(&source.track) {
            return;
        }
        if seconds <= source.start + MIN_DURATION || seconds >= source.end() - MIN_DURATION {
            return;
        }
        let new_id = state.mint("c");
        let head_duration = seconds - source.start;
        let mut tail = source.clone();
        tail.id = new_id;
        tail.start = seconds;
        tail.duration = source.duration - head_duration;
        tail.source_start = source.source_start + head_duration;
        tail.fade_in = 0.0;
        tail.transition_in = false;

        let head = &mut state.now_mut().clips[index];
        head.duration = head_duration;
        head.fade_out = 0.0;
        state.now_mut().clips.push(tail);
        state.selection = vec![id];
    }));

    app.on_band_selected(on_timeline!(
        |state, from: f32, to: f32, from_row: i32, to_row: i32, additive: bool| {
            let caught: Vec<String> = state
                .now()
                .clips
                .iter()
                .filter(|clip| {
                    let row = state.row_of(&clip.track);
                    row >= from_row
                        && row <= to_row
                        && clip.end() >= from
                        && clip.start <= to
                        && !state.locked(&clip.track)
                })
                .map(|clip| clip.id.clone())
                .collect();

            if additive {
                for id in caught {
                    if !state.selection.contains(&id) {
                        state.selection.push(id);
                    }
                }
            } else {
                state.selection = caught;
            }
        }
    ));


    // ── the inspector ──
    //
    // One field and one number rather than a patch of the whole clip: a patch
    // is "everything, with one thing different", and a late-arriving one
    // overwrites whatever landed while it was in flight.
    app.on_clip_set(on_timeline!(|state, field: ClipField, value: f32| {
        let Some(id) = state.selection.first().cloned() else { return };
        let Some(index) = state.now().clips.iter().position(|clip| clip.id == id) else {
            return;
        };
        // Speed re-times the clip in place, so it needs the old rate to scale
        // the duration by; read before the write.
        let previous_speed = state.now().clips[index].speed;
        let clip = &mut state.now_mut().clips[index];

        match field {
            ClipField::Scale => clip.scale = value.clamp(0.05, 8.0),
            ClipField::OffsetX => clip.offset_x = value.clamp(-1.0, 1.0),
            ClipField::OffsetY => clip.offset_y = value.clamp(-1.0, 1.0),
            ClipField::Rotation => clip.rotation = value.clamp(-180.0, 180.0),
            ClipField::Opacity => clip.opacity = value.clamp(0.0, 1.0),
            ClipField::Volume => clip.volume = value.max(0.0),
            ClipField::Speed => {
                let speed = value.clamp(0.0625, 16.0);
                // Source seconds are fixed; the timeline seconds they occupy
                // are what changes. Without this the clip would keep its
                // length and simply play a different amount of material.
                clip.duration = (clip.duration * previous_speed / speed).max(MIN_DURATION);
                clip.speed = speed;
            }
            ClipField::PreservePitch => clip.preserve_pitch = value != 0.0,
            // A fade longer than half the clip would overlap the other one.
            ClipField::FadeIn => clip.fade_in = value.clamp(0.0, clip.duration / 2.0),
            ClipField::FadeOut => clip.fade_out = value.clamp(0.0, clip.duration / 2.0),

            ClipField::FontSize => clip.text.size = value.clamp(0.01, 0.5),
            ClipField::FontWeight => clip.text.weight = value.clamp(100.0, 900.0),
            ClipField::Italic => clip.text.italic = value != 0.0,
            ClipField::TextOpacity => clip.text.opacity = value.clamp(0.0, 1.0),
            ClipField::Align => {
                clip.text.align = match value as i32 {
                    0 => TextAlignment::Left,
                    2 => TextAlignment::Right,
                    _ => TextAlignment::Center,
                }
            }
            ClipField::StrokeWidth => clip.text.stroke_width = value.clamp(0.0, 0.15),
            ClipField::Shadow => clip.text.shadow = value != 0.0,
            ClipField::LineHeight => clip.text.line_height = value.clamp(0.7, 2.5),
            ClipField::Tracking => clip.text.tracking = value.clamp(-0.05, 0.3),
        }
    }));

    app.on_clip_set_text(on_timeline!(|state, field: ClipTextField, value: SharedString| {
        let Some(id) = state.selection.first().cloned() else { return };
        let Some(index) = state.now().clips.iter().position(|clip| clip.id == id) else {
            return;
        };
        let clip = &mut state.now_mut().clips[index];
        match field {
            ClipTextField::Content => {
                clip.text_body = value.to_string();
                // The clip's label follows its first line, the way the
                // reference snapshots a title's words into its name — a lane
                // full of clips all called "Title" is a lane you cannot read.
                let first = value.lines().next().unwrap_or("").trim().to_string();
                clip.name = if first.is_empty() { "Title".into() } else { first };
            }
            ClipTextField::FontFamily => clip.text.family = value.to_string(),
            // The colours arrive through `clip-set-colour`; a colour cannot be
            // spelled as a string Slint could parse back.
            _ => {}
        }
    }));

    app.on_clip_set_colour(on_timeline!(|state, field: ClipTextField, value: slint::Color| {
        let Some(id) = state.selection.first().cloned() else { return };
        let Some(index) = state.now().clips.iter().position(|clip| clip.id == id) else {
            return;
        };
        let clip = &mut state.now_mut().clips[index];
        match field {
            ClipTextField::Color => clip.text.fill = value,
            ClipTextField::StrokeColor => clip.text.stroke = value,
            ClipTextField::Background => clip.text.plate = value,
            _ => {}
        }
    }));

    // The gesture is over. The reference turns everything it accumulated into
    // one undoable command here; there is no command stack in this tree yet,
    // so the seam is the callback.
    app.on_clip_commit(|| {});


    // ── the monitor ──
    //
    // The transport moves the timeline's playhead rather than a second copy of
    // it: the programme position is one number, and a monitor that kept its
    // own would drift from the lanes the moment either moved.
    app.on_seek(on_timeline!(|state, seconds: f32| {
        state.playing = false;
        state.playhead = seconds.clamp(0.0, state.duration());
    }));

    app.on_step_frames(on_timeline!(|state, frames: f32| {
        state.playing = false;
        // Stepped on the frame grid, not by adding a fraction of a second:
        // repeated steps off-grid would accumulate a drift that shows up as a
        // frame field that skips a number.
        let fps = state.frame_rate.round().max(1.0);
        let at = (state.playhead * fps).round() + frames;
        state.playhead = (at / fps).clamp(0.0, state.duration());
    }));

    app.on_ratio_changed(on_timeline!(|state, index: i32| {
        state.ratio = (index.max(0) as usize).min(OUTPUTS.len() - 1);
    }));

    // Preview quality: what fraction of the frame the engine composites for
    // the monitor. It changes nothing on screen here — nothing composites yet
    // — but it is a project setting rather than a view one, so it lives with
    // the rest of them.
    app.on_quality_changed(on_timeline!(|state, index: i32| {
        state.quality = (index.max(0) as usize).min(2);
    }));

    // Playback.
    //
    // A timer only while it is playing, and stopped the moment it is not. The
    // level meter next door had to be gated on hover because it ran forever;
    // this one is self-limiting — a transport that is not running produces no
    // frames, and reaching the tail stops it.
    let playback = Rc::new(Timer::default());
    app.on_play_toggled({
        let weak = app.as_weak();
        let studio = studio.clone();
        let models = timeline_models.clone();
        let playback = playback.clone();
        move || {
            let Some(app) = weak.upgrade() else { return };
            {
                let mut state = studio.borrow_mut();
                if state.playing {
                    state.playing = false;
                    playback.stop();
                } else {
                    // Playing from the tail would sit there doing nothing, so
                    // the button rewinds first — what every editor does.
                    if state.playhead >= state.duration() {
                        state.playhead = 0.0;
                    }
                    state.playing = true;
                }
            }
            let running = studio.borrow().playing;
            if running {
                let rate = studio.borrow().frame_rate.round().max(1.0);
                playback.start(
                    TimerMode::Repeated,
                    std::time::Duration::from_secs_f32(1.0 / rate),
                    {
                        let weak = weak.clone();
                        let studio = studio.clone();
                        let models = models.clone();
                        let playback = playback.clone();
                        move || {
                            let Some(app) = weak.upgrade() else { return };
                            {
                                let mut state = studio.borrow_mut();
                                let end = state.duration();
                                let step = 1.0 / state.frame_rate.round().max(1.0);
                                state.playhead += step;
                                if state.playhead >= end {
                                    state.playhead = end;
                                    state.playing = false;
                                }
                            }
                            if !studio.borrow().playing {
                                playback.stop();
                            }
                            studio.borrow().publish(&app, &models);
                        }
                    },
                );
            }
            studio.borrow().publish(&app, &models);
        }
    });


    // ── the context menu ──
    app.on_clip_context(on_timeline!(|state, id: SharedString| {
        let id = id.to_string();
        if state.clip(&id).is_none() {
            return;
        }
        // Right-clicking selects, the way the reference does: the menu acts on
        // one clip and the selection should say which one before it does.
        if !state.selection.contains(&id) {
            state.selection = vec![id.clone()];
        }
        state.menu_target = Some(id);
        state.menu_token += 1;
    }));

    app.on_menu_selected(on_timeline!(|state, action: SharedString| {
        let Some(id) = state.menu_target.clone() else { return };
        let Some(index) = state.now().clips.iter().position(|clip| clip.id == id) else {
            return;
        };
        let clip = state.now().clips[index].clone();

        match action.as_str() {
            "copy" => state.clipboard = Some(clip),
            "duplicate" | "paste" => {
                let source = if action == "paste" {
                    let Some(held) = state.clipboard.clone() else { return };
                    held
                } else {
                    clip
                };
                let new_id = state.mint("c");
                let mut copy = source.clone();
                copy.id = new_id;
                // Laid after the clip it came from rather than on top of it: a
                // duplicate hidden exactly behind its original looks like
                // nothing happened.
                copy.start = source.end();
                copy.name = format!("{} copy", source.name);
                state.now_mut().clips.push(copy);
            }
            "split" => {
                let at = state.playhead;
                if clip.start + MIN_DURATION >= at || at >= clip.end() - MIN_DURATION {
                    return;
                }
                let new_id = state.mint("c");
                let head = at - clip.start;
                let mut tail = clip.clone();
                tail.id = new_id;
                tail.start = at;
                tail.duration = clip.duration - head;
                tail.source_start = clip.source_start + head;
                tail.fade_in = 0.0;
                tail.transition_in = false;
                state.now_mut().clips[index].duration = head;
                state.now_mut().clips[index].fade_out = 0.0;
                state.now_mut().clips.push(tail);
            }
            "speed-half" | "speed-one" | "speed-two" => {
                let rate = match action.as_str() {
                    "speed-half" => 0.5,
                    "speed-two" => 2.0,
                    _ => 1.0,
                };
                let previous = clip.speed;
                let target = &mut state.now_mut().clips[index];
                target.duration = (target.duration * previous / rate).max(MIN_DURATION);
                target.speed = rate;
            }
            "mute" => {
                // Restored to unity rather than to whatever it was: the menu
                // holds no memory, and a mute that came back at -14 dB would be
                // a surprise every time.
                let target = &mut state.now_mut().clips[index];
                target.volume = if target.volume <= 0.0 { 1.0 } else { 0.0 };
            }
            "lock" => {
                let track = clip.track.clone();
                let now = state.locked(&track);
                if let Some(lane) = state.now_mut().tracks.iter_mut().find(|t| t.id == track) {
                    lane.locked = !now;
                }
                if !now {
                    let doomed: Vec<String> = state
                        .now()
                        .clips
                        .iter()
                        .filter(|c| c.track == track)
                        .map(|c| c.id.clone())
                        .collect();
                    state.selection.retain(|held| !doomed.contains(held));
                }
            }
            "delete" => {
                state.now_mut().clips.retain(|c| c.id != id);
                state.selection.retain(|held| held != &id);
                state.menu_target = None;
            }
            _ => {}
        }
    }));


    // ── the dialogs ──
    app.on_export_clicked(on_timeline!(|state| {
        state.export.open = true;
        state.export.phase = ExportPhase::Idle;
        state.export.message = String::new();
    }));
    app.on_open_settings(on_timeline!(|state| { state.settings.open = true; }));
    app.on_export_closed(on_timeline!(|state| { state.export.open = false; }));
    app.on_settings_closed(on_timeline!(|state| { state.settings.open = false; }));

    app.on_export_name_edited(on_timeline!(|state, name: SharedString| {
        state.export.name = name.to_string();
    }));
    app.on_export_resolution_changed(on_timeline!(|state, index: i32| {
        state.export.resolution = (index.max(0) as usize).min(3);
    }));
    app.on_export_rate_changed(on_timeline!(|state, index: i32| {
        state.export.rate = (index.max(0) as usize).min(2);
    }));
    app.on_export_quality_changed(on_timeline!(|state, index: i32| {
        state.export.quality = (index.max(0) as usize).min(2);
    }));
    app.on_export_again(on_timeline!(|state| {
        state.export.phase = ExportPhase::Idle;
        state.export.progress = 0.0;
    }));
    // Both of these want a file manager, which is a dependency decision rather
    // than a detail of this dialog. The seams are here for the day it lands.
    app.on_export_browse(|| {});
    app.on_export_reveal(|| {});

    // The run itself. A timer, like playback: it exists only while the job
    // does, and it stops itself at the end.
    let exporting = Rc::new(Timer::default());
    app.on_export_cancel({
        let weak = app.as_weak();
        let studio = studio.clone();
        let models = timeline_models.clone();
        let exporting = exporting.clone();
        move || {
            let Some(app) = weak.upgrade() else { return };
            exporting.stop();
            let mut state = studio.borrow_mut();
            state.export.phase = ExportPhase::Idle;
            state.export.progress = 0.0;
            drop(state);
            studio.borrow().publish(&app, &models);
        }
    });

    app.on_export_start({
        let weak = app.as_weak();
        let studio = studio.clone();
        let models = timeline_models.clone();
        let exporting = exporting.clone();
        move || {
            let Some(app) = weak.upgrade() else { return };
            {
                let mut state = studio.borrow_mut();
                state.export.phase = ExportPhase::Running;
                state.export.progress = 0.0;
                state.export.message = String::new();
            }
            exporting.start(TimerMode::Repeated, std::time::Duration::from_millis(90), {
                let weak = weak.clone();
                let studio = studio.clone();
                let models = models.clone();
                let exporting = exporting.clone();
                move || {
                    let Some(app) = weak.upgrade() else { return };
                    {
                        let mut state = studio.borrow_mut();
                        state.export.progress = (state.export.progress + 0.012).min(1.0);
                        if state.export.progress >= 1.0 {
                            state.export.phase = ExportPhase::Done;
                        }
                    }
                    if studio.borrow().export.phase != ExportPhase::Running {
                        exporting.stop();
                    }
                    studio.borrow().publish(&app, &models);
                }
            });
            studio.borrow().publish(&app, &models);
        }
    });

    // ── settings ──
    app.on_settings_page_changed(on_timeline!(|state, index: i32| {
        state.settings.tab = index;
    }));
    app.on_settings_language_changed(on_timeline!(|state, index: i32| {
        state.settings.language = index.max(0) as usize;
    }));
    app.on_settings_transcribe_language_changed(on_timeline!(|state, index: i32| {
        state.settings.transcribe_language = index;
    }));

    app.on_model_activated(on_timeline!(|state, id: SharedString| {
        // One active model per engine, so choosing is also un-choosing. Which
        // list the id is in decides which engine it belongs to.
        let engines = &mut *state;
        for list in [&mut engines.transcribers, &mut engines.voices] {
            if list.iter().any(|model| model.id == id.as_str() && model.installed) {
                for model in list.iter_mut() {
                    model.active = model.id == id.as_str();
                }
            }
        }
    }));

    app.on_model_download(on_timeline!(|state, id: SharedString| {
        let engines = &mut *state;
        for list in [&mut engines.transcribers, &mut engines.voices] {
            if let Some(model) = list.iter_mut().find(|model| model.id == id.as_str()) {
                model.fetched = Some(0.0);
            }
        }
    }));

    app.on_model_cancel(on_timeline!(|state, id: SharedString| {
        let engines = &mut *state;
        for list in [&mut engines.transcribers, &mut engines.voices] {
            if let Some(model) = list.iter_mut().find(|model| model.id == id.as_str()) {
                model.fetched = None;
            }
        }
    }));

    app.on_model_remove(on_timeline!(|state, id: SharedString| {
        let engines = &mut *state;
        for list in [&mut engines.transcribers, &mut engines.voices] {
            if let Some(model) = list.iter_mut().find(|model| model.id == id.as_str()) {
                model.installed = false;
                model.active = false;
                model.fetched = None;
            }
            // An engine with nothing active falls back to whatever is left,
            // rather than silently having no model at all.
            if list.iter().all(|model| !model.active) {
                if let Some(next) = list.iter_mut().find(|model| model.installed) {
                    next.active = true;
                }
            }
        }
    }));

    // Downloads advance on one timer for all of them: they are simulated, and
    // a timer each would be a timer each for no reason.
    let downloads = Rc::new(Timer::default());
    downloads.start(TimerMode::Repeated, std::time::Duration::from_millis(120), {
        let weak = app.as_weak();
        let studio = studio.clone();
        let models = timeline_models.clone();
        move || {
            let Some(app) = weak.upgrade() else { return };
            let mut moved = false;
            {
                let mut state = studio.borrow_mut();
                let engines = &mut *state;
        for list in [&mut engines.transcribers, &mut engines.voices] {
                    for model in list.iter_mut() {
                        let Some(fetched) = model.fetched else { continue };
                        moved = true;
                        let next = fetched + 12.0 * 0.12 * 8.0;
                        if next >= model.megabytes {
                            model.fetched = None;
                            model.installed = true;
                        } else {
                            model.fetched = Some(next);
                        }
                    }
                }
            }
            // Only republish when something actually moved: this ticks for the
            // life of the process, and a republish on every tick would redraw
            // the whole window eight times a second to change nothing.
            if moved {
                studio.borrow().publish(&app, &models);
            }
        }
    });

    // ── the tray's A/V menu ──
    app.on_av_tools(on_timeline!(|state| { state.av_token += 1; }));

    app.on_av_selected(on_timeline!(|state, action: SharedString| {
        let Some(id) = state.selection.first().cloned() else { return };
        let Some(index) = state.now().clips.iter().position(|clip| clip.id == id) else {
            return;
        };
        let clip = state.now().clips[index].clone();

        match action.as_str() {
            // Both of these end in a dialog this tree has not grown — the
            // transcriber's sheet and the speech one. The edit each performs is
            // real; what is missing is the sheet in front of it.
            "captions" | "speak" => {}
            "detach" => {
                // The sound leaves the picture and becomes its own clip on the
                // lane below, keeping a pointer home so it can be put back.
                let new_id = state.mint("c");
                let row = state.row_of(&clip.track);
                let below = state
                    .row_track(row + 1)
                    .map(|track| track.id.clone())
                    .unwrap_or_else(|| clip.track.clone());
                let mut sound = clip.clone();
                sound.id = new_id;
                sound.kind = ClipKind::Audio;
                sound.track = below;
                sound.name = format!("{} audio", clip.name);
                sound.detached_from = Some(clip.id.clone());
                sound.fx = false;
                sound.transition_in = false;
                state.now_mut().clips[index].volume = 0.0;
                state.now_mut().clips.push(sound);
            }
            "reattach" => {
                let parent = clip.detached_from.clone().unwrap_or_else(|| clip.id.clone());
                let doomed: Vec<String> = state
                    .now()
                    .clips
                    .iter()
                    .filter(|other| other.detached_from.as_deref() == Some(parent.as_str()))
                    .map(|other| other.id.clone())
                    .collect();
                state.now_mut().clips.retain(|other| !doomed.contains(&other.id));
                if let Some(video) = state.now_mut().clips.iter_mut().find(|c| c.id == parent) {
                    video.volume = 1.0;
                }
                state.selection = vec![parent];
            }
            _ => {}
        }
    }));


    // ── the title-bar menus ──
    app.on_menu_opened(on_timeline!(|state, index: i32| {
        state.open_menu = index;
        state.menu_bar_token += 1;
    }));

    app.on_app_menu_selected({
        let weak = app.as_weak();
        let studio = studio.clone();
        let models = timeline_models.clone();
        move |action| {
            let Some(app) = weak.upgrade() else { return };
            {
                let mut state = studio.borrow_mut();
                state.open_menu = -1;
                match action.as_str() {
                    "export" => {
                        state.export.open = true;
                        state.export.phase = ExportPhase::Idle;
                        state.export.message = String::new();
                    }
                    "settings" => state.settings.open = true,
                    "snap" => state.snap = !state.snap,
                    "zoom-in" => {
                        state.seconds_per_pixel = (state.seconds_per_pixel / 1.4).max(0.000_5);
                    }
                    "zoom-out" => {
                        state.seconds_per_pixel = (state.seconds_per_pixel * 1.4).min(1.5);
                    }
                    "start" => {
                        state.playing = false;
                        state.playhead = 0.0;
                    }
                    "end" => {
                        state.playing = false;
                        state.playhead = state.duration();
                    }
                    "delete" => {
                        let doomed = state.selection.clone();
                        state.now_mut().clips.retain(|clip| !doomed.contains(&clip.id));
                        state.selection.clear();
                    }
                    "split" => {
                        let at = state.playhead;
                        let victims: Vec<String> = state
                            .now()
                            .clips
                            .iter()
                            .filter(|clip| {
                                clip.start + MIN_DURATION < at
                                    && at < clip.end() - MIN_DURATION
                                    && !state.locked(&clip.track)
                            })
                            .map(|clip| clip.id.clone())
                            .collect();
                        for victim in victims {
                            let Some(index) =
                                state.now().clips.iter().position(|c| c.id == victim)
                            else {
                                continue;
                            };
                            let source = state.now().clips[index].clone();
                            let new_id = state.mint("c");
                            let head = at - source.start;
                            let mut tail = source.clone();
                            tail.id = new_id;
                            tail.start = at;
                            tail.duration = source.duration - head;
                            tail.source_start = source.source_start + head;
                            tail.fade_in = 0.0;
                            tail.transition_in = false;
                            state.now_mut().clips[index].duration = head;
                            state.now_mut().clips[index].fade_out = 0.0;
                            state.now_mut().clips.push(tail);
                        }
                    }
                    // Saving, templates, speech and closing a project all need
                    // a store this crate does not have. The rows are here so
                    // the menu is the shape it will be; wiring them is a
                    // handler each the day one exists.
                    _ => {}
                }
            }
            if action == "close-window" {
                app.window().hide().ok();
                return;
            }
            studio.borrow().publish(&app, &models);
        }
    });

    studio.borrow().publish(&app, &timeline_models);

    // --- the pieces Slint cannot express ---------------------------------
    app.global::<Curves>()
        .on_ease(|x1, y1, x2, y2, at| bezier_y_at_x(x1, y1, x2, y2, at));
    app.global::<Curves>()
        .on_parse(|text, fallback| parse_bezier(text.as_str(), fallback));
    app.global::<Fmt>()
        .on_parse_timecode(|text| parse_timecode(text.as_str()));
    app.global::<Fmt>().on_tick_interval(tick_interval);
    app.global::<Fmt>()
        .on_parse_frames(|text, rate| parse_frames(text.as_str(), rate));

    // --- simulated programme level ---------------------------------------
    //
    // Armed by hover rather than left running for the life of the process.
    //
    // Thirty samples a second is an animation however it is produced: each one
    // writes `level` and `peak`, and the whole window is redrawn for every dirty
    // property — Skia has partial-rendering machinery but it is off on every
    // GPU surface, and FemtoVG has none at all. Left running, the
    // feed alone held the app at ~10% of a core doing nothing but re-drawing a
    // bar nobody was looking at. The meter reports hover (see the TouchArea in
    // level-meter.slint) and the timer follows it, so an unattended window
    // costs no frames at all.
    let sim = Rc::new(LevelSim::new());
    let level_timer = Rc::new(Timer::default());
    app.on_meter_watched_changed({
        let weak = app.as_weak();
        let sim = sim.clone();
        let level_timer = level_timer.clone();
        move |watched| {
            let Some(app) = weak.upgrade() else { return };
            if !watched {
                // Park at silence. Freezing on the last sample would leave the
                // bar stopped mid-signal, which reads as a hung meter; zero
                // reads as no programme, which is what it is. Peak goes
                // negative rather than to zero because that hides the hold
                // marker outright, the same way muting does — a tick pinned at
                // the left edge is just debris.
                level_timer.stop();
                sim.reset();
                app.set_level(0.0);
                app.set_peak(-1.0);
                return;
            }
            level_timer.start(
                TimerMode::Repeated,
                std::time::Duration::from_millis(33),
                {
                    let weak = weak.clone();
                    let sim = sim.clone();
                    move || {
                        let Some(app) = weak.upgrade() else { return };
                        if app.get_muted() {
                            sim.reset();
                            app.set_level(0.0);
                            app.set_peak(0.0);
                            return;
                        }
                        let (level, peak) = sim.tick(0.033);
                        app.set_level(level);
                        app.set_peak(peak);
                    }
                },
            );
        }
    });

    app.run()
}
