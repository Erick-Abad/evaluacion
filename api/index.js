'use strict';

const {server}=require('../app_server');

module.exports=(req,res)=>server.emit('request',req,res);
