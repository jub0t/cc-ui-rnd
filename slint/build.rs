fn main() {
    // Fonts and images are compiled into the binary rather than read off disk
    // at run time.
    //
    // `EmbedFiles` keeps each file exactly as it is — a PNG stays compressed,
    // a TTF stays a TTF — and hands it to the renderer from memory instead of
    // opening it. What that buys is a startup that touches no files and a
    // binary that is the whole application: six font faces, a logo and twenty
    // effect previews travel inside it, so there is no directory to ship
    // beside it and no path to get wrong.
    //
    // Not `EmbedForSoftwareRenderer`, which pre-decodes to raw pixels: that is
    // for MCUs with no filesystem, it is the only kind the software renderer
    // can read, and Skia and FemtoVG cannot use it at all.
    let config = slint_build::CompilerConfiguration::new()
        .embed_resources(slint_build::EmbedResourcesKind::EmbedFiles);
    slint_build::compile_with_config("ui/app.slint", config)
        .expect("failed to compile ui/app.slint");
}
