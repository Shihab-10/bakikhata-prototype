# Team Organization Guide

| Folder | Who Edits | Purpose |
| :--- | :--- | :--- |
| `index.html`, `pages/*.html` | HTML / UI Team | Page structure only |
| `css/*.css`, `css/pages/*.css` | Design / CSS Team | Pure CSS tokens, Light/Dark themes |
| `js/core/*.js` | Core JS Lead | IndexedDB, i18n BN/EN + digits, Theme, Voice |
| `js/components/*.js` | Component Dev | Header, 5-tab Bottom Nav, Voice Modal, Toast |
| `js/services/*.js` | Backend Bridge | Switches IndexedDB (now) -> FastAPI (later) |
| `js/pages/*.js` | Page Logic Team | Connects HTML UI to services |
