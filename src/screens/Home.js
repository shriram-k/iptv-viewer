import React from "react";
import Wrapper from "../components/Wrapper";
import CountryHorizontalScrollbar from "../components/CountryHorizontalScrollbar";
import CategoryHorizontalScrollbar from "../components/CategoryHorizontalScrollbar";

const Home = ({countries, groups}) => {
    

    return (
    <Wrapper>
        <div style={{backgroundColor: '', height: 'inherit'}}>
            <CountryHorizontalScrollbar countries={countries} />
            <CategoryHorizontalScrollbar categories={groups} />
        </div>
    </Wrapper>
    )
}

export default Home;