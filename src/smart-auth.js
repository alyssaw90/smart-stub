"use strict";

var jwt = require("jsonwebtoken");
var bodyParser = require("body-parser");
var router = require("express").Router();
var request = require('request');
var xml2js = require('xml2js');
var config = require('./config');

module.exports = router;

// Need polyfills for older Node.js implementations
String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};
Object.assign = require('object-assign');

function normalizeURL(url) {
  if (url.endsWith('/')) {
    url = url.substring(0, url.length - 1);
  }
  return url.toLowerCase();
}

router.get("/authorize", function (req, res) {
  if (normalizeURL(req.query.aud) != normalizeURL(config.baseUrl + '/api/fhir')) {
    //TODO: follow oauth spec here
    console.log("Bad AUD value: " + req.query.aud + " (expecting " + config.baseUrl + '/api/fhir)');
    return res.send("Bad audience value", 400);
  }
  var incomingJwt = req.query.launch && req.query.launch.replace(/=/g, "");
  var code = {
    context: incomingJwt && jwt.decode(incomingJwt) || {},
    client_id: req.query.client_id,
    scope: req.query.scope
  };
  var state = req.query.state;
  var signedCode = jwt.sign(code, config.jwtSecret, { expiresIn: "5m" });
  res.redirect(req.query.redirect_uri + ("?code=" + signedCode + "&state=" + state));
});

router.post("/token", bodyParser.urlencoded({ extended: false }), function (req, res) {
  var grantType = req.body.grant_type;
  var codeRaw;

  if (grantType === 'authorization_code') {
    codeRaw = req.body.code;
  } else if (grantType === 'refresh_token') {
    codeRaw = req.body.refresh_token;
  }

  try {
    var code = jwt.verify(codeRaw, config.jwtSecret);
  } catch (e) {
    return res.status(401).send("invalid token");
  }

  if (code.scope.indexOf('offline_access') >= 0) {
    code.context['refresh_token'] = jwt.sign(code, config.jwtSecret);
  }

  var token = Object.assign({}, code.context, {
    token_type: "bearer",
    expires_in: 3600,
    scope: code.scope,
    client_id: req.body.client_id
  });
  token.access_token = jwt.sign(Object.assign({}, token), config.jwtSecret, { expiresIn: "1h" });
  res.json(token);
});
