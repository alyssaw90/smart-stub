var jwt        = require("jsonwebtoken")
var bodyParser = require("body-parser")
var router     = require("express").Router()
var request    = require('request')

module.exports = (config) => {

	router.get("/metadata", (req, res) => {

		var url = config.fhirServer + "/metadata"

		request({
		    url: url,
		    json: true
		}, function (error, response, body) {
		    if (!error && response.statusCode === 200) {
		    	var conformance = body
		        //TODO: handle xml metadata requests
				conformance.rest[0].security['extension'] = [{
			      "url": "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris",
				  "extension": [{
			        "url": "authorize",
			        "valueUri": config.baseUrl + "/authorize"
			      },{
			        "url": "token",
			        "valueUri": config.baseUrl + "/token"
			      }]
				}]
				res.type("application/json+fhir")
				res.send(conformance)
		    }
		})
	})

	router.get("/authorize", (req, res) => {
		if (req.query.aud != config.baseUrl) {
			//TODO: follow oauth spec here
			return res.send("Bad audience value", 400)
		}
		var incomingJwt = req.query.launch.replace(/=/g, "")
		var code = {
			context: jwt.decode(incomingJwt),
			client_id: req.query.client_id,
			scope: req.query.scope
		}
		var state = req.query.state
		var signedCode = jwt.sign(code, config.jwtSecret, {expiresIn: "5m"})
		res.redirect(req.query.redirect_uri + `?code=${signedCode}&state=${state}`)
	})

	router.post("/token", bodyParser.urlencoded({extended: false}), (req, res) => {
		var code = jwt.verify(req.body.code, config.jwtSecret)

		var token = Object.assign({}, code.context, {
			token_type: "bearer",
			expires_in: 3600,
			scope: code.scope, 
			client_id: req.body.client_id
		})
		token.access_token = jwt.sign(Object.assign({}, token), config.jwtSecret, {expiresIn: "1h"})
		res.json(token)
	})

	return router

}
