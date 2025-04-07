import React, { useEffect, useCallback} from 'react';
import './App.css';
import playlistParser from './helpers/playlistParser';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import Home from './screens/Home';
import Search from './screens/Search';
import Country from './screens/Country';
import Category from './screens/Category';
import Player from './screens/Player';
import SplashScreen from './screens/Splash';
import Channels from './screens/Channels';
import useAppWide from './providers/appWide/hook';
import ScrollToTop from './components/ScrollToTop';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

function App() {
  const {
    state: {channels, showSplashScreen},
    actions: {setChannels, setCountries, setCategories, setShowSplashScreen}
  } = useAppWide();

  const firebaseConfig = {
    apiKey: "AIzaSyAWi_JoPjxd0403I-1pmoYg1FY79sKDSxs",
    authDomain: "iptv-player-7f741.firebaseapp.com",
    projectId: "iptv-player-7f741",
    storageBucket: "iptv-player-7f741.firebasestorage.app",
    messagingSenderId: "445593910318",
    appId: "1:445593910318:web:26d608d53455968ec773bf",
    measurementId: "G-7SW9D2P3LV"
  };

  const app = initializeApp(firebaseConfig);
  getAnalytics(app);
  

  const parsePlaylist = useCallback(async () => {
    setShowSplashScreen(true);
    const channelData = await playlistParser()
    setChannels(channelData.channels)
    setCountries(channelData.countries)
    setCategories(channelData.categories)
    setShowSplashScreen(false);
  }, [setCategories, setChannels, setCountries, setShowSplashScreen])

  useEffect(() => {
    if(channels.length < 1) {
      parsePlaylist()
    }
  }, [channels, parsePlaylist])

  const App = () => {

    const routes = createHashRouter([
      {
        path: '/',
        element: <Home />,
      },
      {
        path: '/search',
        element: <Search />,
      },
      {
        path: '/categories',
        element: <Category />,
      },
      {
        path: '/countries',
        element: <Country />,
      },
      {
        path: '/tvplayer',
        element: <Player />,
      },
      {
        path: '/channels',
        element: <Channels />
      }
    ])

    return (
      <RouterProvider router={routes} >
        <ScrollToTop />
      </RouterProvider>
    )
  }

  return (
    <div>
      {showSplashScreen ? <SplashScreen /> : <App />}
    </div>
  );
}

export default App;
