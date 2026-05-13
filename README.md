# Elikha Student Web - React App

This is a React.js application for the Elikha Student Learning Platform.

## Installation

1. Make sure you have Node.js installed (v14 or higher)
2. Navigate to the react-app directory:
   ```bash
   cd c:\xampp\htdocs\elikha_studentweb\react-app
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

To start the development server:

```bash
npm start
```

The app will open at `http://localhost:3000`

## Building for Production

To create a production build:

```bash
npm run build
```

The build files will be in the `build` folder, which you can deploy to XAMPP or any web server.

## Features

- **React Router** - Navigation between pages
- **Session Storage** - User authentication
- **Responsive Design** - Works on mobile and desktop
- **Component-Based** - Reusable React components
- **Modern Styling** - Clean CSS with animations

## Project Structure

```
react-app/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── ProfileSection.jsx
│   │   ├── ArtworkCarousel.jsx
│   │   ├── ActivityCard.jsx
│   │   └── Navbar.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Homepage.jsx
│   │   ├── Activities.jsx
│   │   ├── Profile.jsx
│   │   └── Settings.jsx
│   ├── styles/
│   │   ├── index.css
│   │   └── App.css
│   ├── App.js
│   └── index.js
└── package.json
```

## Pages

- **Login** - User authentication
- **Homepage** - Dashboard with profile, artworks, and activities
- **Activities** - List of all activities
- **Profile** - User profile information
- **Settings** - App settings and logout
