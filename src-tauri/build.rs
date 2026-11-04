fn main() {
    let icon_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("icons");
    std::fs::create_dir_all(&icon_dir).expect("create Tauri icon directory");
    const ICON: &[u8] = &[0,0,1,0,1,0,1,1,0,0,1,0,32,0,48,0,0,0,22,0,0,0,40,0,0,0,1,0,0,0,2,0,0,0,1,0,32,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,235,99,37,255,0,0,0,0];
    std::fs::write(icon_dir.join("icon.ico"), ICON).expect("write Windows icon");
    tauri_build::build();
}
