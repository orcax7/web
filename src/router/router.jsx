import React, { useState } from "react";
import { Route, Routes } from "react-router-dom";
import Home from './../Components/home';
import EditForm from "../Components/editor";
import Summary from "../Components/summary";
import { dataContext } from '../Context/context';

export default function Router() {
    const [value, setValue] = useState(0)
    const [file, setFile] = useState([])
    const [crrFile, setCrrFile] = useState("newfile.js");
    const [activePage, setActivePage] = useState('');
    return (
        <dataContext.Provider value={[[value, setValue], [file, setFile], [crrFile, setCrrFile], [activePage, setActivePage]]}>
            <Routes style={{ margin: '20px' }}>
                <Route path="/" element={<Home />} />
                <Route path="/analize" element={<EditForm />} />
                <Route path="/summary" element={<Summary />} />
                <Route path="/*" element={<div style={{ textAlign: 'center' }}>Error 404 Not Found</div>} />
            </Routes>
        </dataContext.Provider>
    )
}