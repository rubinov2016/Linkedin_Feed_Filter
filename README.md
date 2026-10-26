# LinkedIn Feed Filter (Chrome, Manifest V3)

Hides LinkedIn feed posts by author gender, headline keywords (HR, recruiter, coach…) and selfie photos, and can auto-scroll the feed for a while and then show only the posts that survive.

## Install

1. Unzip the folder.
2. Chrome → `chrome://extensions` → enable **Developer mode** (top right) → **Load unpacked** → pick the folder.
3. Open linkedin.com/feed. The badge on the toolbar icon shows how many posts are hidden on the page.
4. Right-click the icon → **Options** (or popup → Settings…) to configure everything.

## Filters

1. **Gender** – LinkedIn has no gender field. Cascade: pronouns next to the name (She/Her, He/Him) → first-name lists (EN + RU, editable) → Russian -а/-я ending → face-gender classification of the profile photo (local, face-api.js). Each step can be switched off; choose which detected genders to skip (default: female).
2. **Profession / keywords** – keyword list matched against the headline (optionally company, name, post text); substring or whole-word mode.
3. **Photo** – default rule: post has an image, a face is detected in it, and the face's classified gender equals the author's resolved gender → hidden ("selfie"). Alternatives: any face, or any image post.
4. **Promoted / suggested** posts – optional.

Hidden posts collapse to a one-line grey stub with the reason and a **show** link, or are removed completely (setting).

## Load & condense

Popup → **Load & condense**: the page auto-scrolls until N seconds or M posts (defaults 60 s / 200 posts), waits for the face analysis to finish, applies the filters, scrolls back to top and shows a bar "Loaded X · hidden Y · showing Z" with **Load more** / **Show hidden**. Hidden posts are removed completely in this mode by default (setting). Can also auto-start on every feed open.

## Notes

- All detection runs in the browser; the only network traffic is fetching LinkedIn's own images through the extension's background worker (needed so the images can be analysed on a canvas).
- Models: face-api.js 0.22.2 `tiny_face_detector` + `age_gender_model` (~620 KB), bundled in `models/`.
- LinkedIn changes its markup periodically. If posts stop being detected, edit the **DOM selectors** JSON in Options (Advanced) instead of reinstalling.
- Set `window.LFF_DEBUG = true` in the page console for verbose logs.
- Gender detection is a heuristic by design and will misfire on unisex names and ambiguous photos; the stub's **show** link is there to check it.
