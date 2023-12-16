import React from "react"
import { Link } from "react-router-dom";
import {FaSearch} from 'react-icons/fa';

const AppBar = () => {

    return (
        <nav style={{
            height: '50px',
            paddingLeft: '50px',
            paddingRight: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <Link to={'/'} id='logo' style={{textDecoration: 'none', color: '#000'}} >
                <p style={{fontFamily: 'Caveat', fontSize: 18}}>
                    Public domain IPTV
                </p>
            </Link>
            <ul id='navigation' style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}} >
                <li id='search' style={{listStyle: 'none'}}>
                    <Link to={'/search'} style={{textDecoration: 'none', color: '#000', fontSize: 16}} ><FaSearch style={{marginRight: '5px', fontSize: 10}} />Search</Link>
                </li>
            </ul>
        </nav>
    )
}

export default AppBar