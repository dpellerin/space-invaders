# Space Invaders '78

A browser-based arcade game inspired by the 1978 classic. Defend Earth against five rows of invaders, take cover behind destructible shields, and shoot the occasional UFO for bonus points.

## Play

Open `index.html` in a modern browser. No installation, build step, or internet connection is required.

You can also serve the folder locally:

```sh
python3 -m http.server 8000
```

Then visit [localhost:8000](http://localhost:8000).

## Publish with GitHub Pages

1. Push this project to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**, then choose the `main` branch and `/ (root)` folder. Save.
4. Once GitHub finishes publishing, open the URL shown in the Pages settings. Future pushes to `main` will update the site.

The site is static and needs no build configuration. For a project repository, the URL is typically `https://USERNAME.github.io/REPOSITORY/`.

## Controls

| Action | Keyboard | Standard Xbox controller |
| --- | --- | --- |
| Move | Left/right arrows or A/D | Left stick or D-pad |
| Fire | Space | A or right trigger |
| Start or restart | Enter | Menu button |

You can also use the on-screen button to start or restart. If a controller isn't detected, connect it and press a button; support varies by browser and operating system.

## How to play

- Destroy all 55 invaders to win. You start with three lives, and the game also ends if an invader reaches your defense line.
- Shields absorb shots from both sides and wear away as they take damage.
- Shoot the UFO crossing the top of the screen for bonus points.
- Use the sound button below the screen to mute or unmute audio. Your high score is saved in browser storage when available.

## Project files

- `index.html` — page and game controls
- `style.css` — arcade cabinet styling
- `game.js` — game logic, rendering, and input
- `sounds/` — audio samples used by the game
