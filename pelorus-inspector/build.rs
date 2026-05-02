fn main() {
    // Sync package.json version with Cargo.toml
    sync_package_version();

    // Ensure tauri.conf.json uses null version (inherits from Cargo.toml)
    check_tauri_version();

    // Fail early if dist is missing
    if !std::path::Path::new("dist/index.html").exists() {
        panic!(
            "\n\
            ══════════════════════════════════════════════════════════════\n\
            ERROR: dist/ folder missing\n\
            \n\
            Run `npm run build` first to build the frontend.\n\
            ══════════════════════════════════════════════════════════════\n"
        );
    }

    tauri_build::build()
}

fn sync_package_version() {
    let version = env!("CARGO_PKG_VERSION");
    let pkg_path = std::path::Path::new("package.json");

    if let Ok(content) = std::fs::read_to_string(pkg_path) {
        // Find and replace "version": "x.y.z" pattern
        let mut new_content = String::new();
        let mut remaining = content.as_str();

        if let Some(pos) = remaining.find("\"version\":") {
            new_content.push_str(&remaining[..pos]);
            remaining = &remaining[pos..];

            // Find the opening quote of the version value
            if let Some(colon_end) = remaining.find(':') {
                let after_colon = &remaining[colon_end + 1..];
                if let Some(quote1) = after_colon.find('"') {
                    let after_quote1 = &after_colon[quote1 + 1..];
                    if let Some(quote2) = after_quote1.find('"') {
                        // Build the replacement
                        new_content.push_str(&remaining[..colon_end + 1]);
                        new_content.push_str(&after_colon[..quote1 + 1]);
                        new_content.push_str(version);
                        new_content.push_str(&after_quote1[quote2..]);

                        if new_content != content {
                            let _ = std::fs::write(pkg_path, &new_content);
                            println!("cargo:warning=Synced package.json version to {version}");
                        }
                    }
                }
            }
        }
    }

    println!("cargo:rerun-if-changed=Cargo.toml");
}

fn check_tauri_version() {
    let tauri_conf = std::path::Path::new("tauri.conf.json");
    if let Ok(content) = std::fs::read_to_string(tauri_conf) {
        // Check for "version": null (with flexible whitespace)
        if content.contains("\"version\"") && !content.contains("\"version\": null") {
            panic!(
                "\n\
                ══════════════════════════════════════════════════════════════\n\
                ERROR: tauri.conf.json has hardcoded version\n\
                \n\
                Set \"version\": null to inherit from Cargo.toml.\n\
                ══════════════════════════════════════════════════════════════\n"
            );
        }
    }
    println!("cargo:rerun-if-changed=tauri.conf.json");
}
