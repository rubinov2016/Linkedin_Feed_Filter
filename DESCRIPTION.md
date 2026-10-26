I vibe-coded a Chrome extension that filters my LinkedIn feed. Took one evening.

The feed is 70 % noise for me: recruiters, coaches, selfies with motivational captions, promoted posts, and content in languages I don't read. LinkedIn gives no controls beyond "unfollow", so I built my own.

What it does:
– Keyword filter on the author's headline (HR, recruiter, talent acquisition, coach… editable list)
– Selfie filter: post has a photo, a face is detected, and the face matches the author – hidden. Face detection runs locally in the browser (face-api.js), nothing leaves the machine
– Language filter by script-specific letters (Ukrainian, Kazakh, Uzbek, Belarusian – pick which)
– Geo words in the headline (any list of countries/cities)
– Author filters by name lists and pronouns
– Promoted/suggested posts

Killer feature: "Load & condense" – it scrolls the feed for a minute, runs the filters on 200 posts, scrolls back up and shows the 60 that survived. Every hidden post collapses into a one-line stub with the reason ("Keyword 'hr' in headline", "Selfie 91 %", "Language: uk") and a "show" link, so false positives are one click away.

Tech: Manifest V3, one content script, MutationObserver, tiny face detector + age/gender net, ~1.3 MB with models. The hard part: LinkedIn moved to a server-driven UI with obfuscated class names, so the parser works off the visible card text instead of selectors.

Not publishing the code – with today's tools anyone can build their own version in ten minutes, and your noise is different from mine.

#chromeextension #vibecoding #linkedin #javascript
