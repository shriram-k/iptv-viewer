import React from "react";
import Wrapper from "../components/Wrapper";
import CountryCard from "../components/CountryCard";

const Country = ({countries}) => {
    return (
    <Wrapper>
        <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '20px',
            }} >
            {
                countries.map((eachCountry, idx) => <CountryCard ky={idx} country={eachCountry}  />)
            }
        </div>
    </Wrapper>
    )
}

export default Country;