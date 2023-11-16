import logo from './logo.svg';
import './App.css';
import playlistParser from './helpers/playlistParser';

function App() {

  const parseplaylist = async () => {
    const channels = await playlistParser();
    console.log(channels)
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <button onClick={parseplaylist} >Run</button>
      </header>
    </div>
  );
}

export default App;
