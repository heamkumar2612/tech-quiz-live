# Tech Quiz Live

A real-time 50-player quiz using Node.js, Express and Socket.IO.

## Scoring
Correct answer: 500 base points + up to 500 speed points.
Wrong answer: 0.
With a 20-second timer:
`points = round(500 + 500 * (time remaining / 20))`

## Run locally
1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000` for players.
6. Open `http://localhost:3000/host.html` for the host.
7. Default quiz code: `482917`.

## GitHub
Create a new repository and push this whole folder:
```bash
git init
git add .
git commit -m "Initial live tech quiz"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

## Important
GitHub Pages cannot run this Node.js/Socket.IO server. Keep the code on GitHub, then deploy the repository to a Node.js hosting service such as Render.

## Render deployment
- Create a new Web Service.
- Connect your GitHub repository.
- Build command: `npm install`
- Start command: `npm start`
- Optional environment variable: `QUIZ_CODE=482917`
- Deploy.
- Share the deployed root URL with students.
- Open `/host.html` on the projector/laptop.

## Before the event
Test with several phones. Keep the host laptop and students on stable internet. The current version stores quiz state in server memory, so restarting the server resets the game.
