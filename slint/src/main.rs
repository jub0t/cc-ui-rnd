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
                .cloned()
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

    // --- the pieces Slint cannot express ---------------------------------
    app.global::<Curves>()
        .on_ease(|x1, y1, x2, y2, at| bezier_y_at_x(x1, y1, x2, y2, at));
    app.global::<Curves>()
        .on_parse(|text, fallback| parse_bezier(text.as_str(), fallback));
    app.global::<Fmt>()
        .on_parse_timecode(|text| parse_timecode(text.as_str()));

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
