import React, {useState, useEffect} from "react";
import Wrapper from "../components/Wrapper";
import { useSearchParams, useNavigate } from "react-router-dom";

const Channels = ({channels: channelData}) => {
    let [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [channels, setChannels] = useState([]);

    const getChannelsForCountry = (data, filter)  => {
        return data.filter((eachChannel) => eachChannel?.country?.code === filter);
    }

    const getChannelsForCategory = (data, filter) => {
        return data.filter((eachChannel) => eachChannel?.group.includes(filter));
    }

    const getChannels = () => {
        const country = searchParams.get('country');
        const category = searchParams.get('category');
        console.log({category, country});
        if(country && !category) {
            setChannels(getChannelsForCountry(channelData, country));
        }
        if(category && !country) {
            setChannels(getChannelsForCategory(channelData, category));
        }
    }

    const gotoPlayer = (id) => {
        navigate(`/tvplayer?channelId=${id}`)
    }

    useEffect(() => {
        if(channels.length < 1) {
            getChannels();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    return(
        <Wrapper>
            <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '20px',}} >
            {
                channels.map((eachChannel, idx) => (
                        <div style={{
                            width: '250px',
                            height: '100px',
                            display: 'flex', 
                            flexDirection: 'row',
                            boxShadow: '0px 0px 6px 0px lightgray',
                            borderRadius: '4px',
                            margin: '10px',
                            cursor: 'pointer',
                        }} key={idx} onClick={() => gotoPlayer(eachChannel.id)} >
                            <div style={{flex: 1, alignItems: 'center', justifyContent: 'center', display: 'flex'}}>
                                <img style={{maxWidth: 80, maxHeight: 80}} src={eachChannel.logo} alt={eachChannel.name} />
                            </div>
                            <div style={{flex: 1, padding: '5px', fontSize: '0.8rem'}} >
                                <div style={{}}>{eachChannel.name}</div>
                                <div style={{fontWeight: 600, marginTop: '5px'}} >Genre:</div>
                                <div>{eachChannel.group.join(', ')}</div>
                            </div>
                        </div>
                    )
                )
            }
            </div>
        </Wrapper>
    )
}

export default Channels;