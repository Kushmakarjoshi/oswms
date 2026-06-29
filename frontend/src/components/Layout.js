import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = ({ children }) => (
  <div className="oswms-app">
    <Navbar />
    <main className="oswms-main">{children}</main>
    <Footer />
  </div>
);

export default Layout;
