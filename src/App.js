import React, {useState, useEffect} from 'react';
import './App.css';
import playlistParser from './helpers/playlistParser';
import countryHelper from './helpers/countryHelper';
import groupHelper from './helpers/groupHelper';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Home from './screens/Home';
import Search from './screens/Search';
import Country from './screens/Country';
import Group from './screens/Group';
import Player from './screens/Player';
import SplashScreen from './screens/Splash';
import Channels from './screens/Channels';

function App() {
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const [channels, setChannels] = useState([]);
  const [countries, setCountries] = useState([]);
  const [groups, setGroups] = useState([]);

  const parsePlaylist = async () => {
    const channelData = await playlistParser()
    const countryData = countryHelper(channelData);
    const groupData = groupHelper(channelData)
    setChannels(channelData)
    setCountries(countryData)
    setGroups(groupData)
    setShowSplashScreen(false);
  }

  useEffect(() => {
    if(channels.length < 1) {
      setShowSplashScreen(true)
      parsePlaylist()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const App = () => {

    const routes = createBrowserRouter([
      {
        path: '/',
        element: <Home countries={countries} groups={groups} />,
      },
      {
        path: '/search',
        element: <Search channels={channels}/>,
      },
      {
        path: '/categories',
        element: <Group channels={channels} />,
      },
      {
        path: '/countries',
        element: <Country countries={countries} />,
      },
      {
        path: '/tvplayer',
        element: <Player channels={channels} />,
      },
      {
        path: '/channels',
        element: <Channels channels={channels} />
      }
    ])

    return (
      <RouterProvider router={routes} />
    )
  }

  return (
    <div>
      {showSplashScreen ? <SplashScreen /> : <App />}
      {/* <App /> */}
    </div>
  );
}

export default App;
