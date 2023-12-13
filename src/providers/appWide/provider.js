import { useState } from 'react';
import AppWideContext from './context';

const AppWideProvider = ({ children }) => {
  const [channels, setChannels] = useState(['wefwefwef']);
  const [countries, setCountries] = useState(['wefwefwf']);
  const [categories, setCategories] = useState(['wdqwfwrge']);
  const value = {
    state: { channels, countries, categories },
    actions: { setChannels, setCountries, setCategories },
  };
  return (
    <AppWideContext.Provider value={value}>
      {children}
    </AppWideContext.Provider>
  )
}

export default AppWideProvider;