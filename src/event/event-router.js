const path = require('path');
const express = require('express');
const EventService = require('./event-service');
const {requireAuth} = require('../middleware/jwt-auth');

const eventRouter = express.Router();
const jsonParser = express.json();

eventRouter
    .route('/')
    .all(requireAuth)
    .get((req, res, next) => {
        EventService.getAllEvents(req.app.get('db'))
            .then(events => {
                res.json(EventService.serializeEvents(events))
            })
            .catch(next)
    })
    .post(jsonParser, (req, res, next) => {
        const {title, sport, datetime, max_players, description} = req.body;
        const newEvent = {title, sport, datetime, max_players};

        for(const [key, value] of Object.entries(newEvent)) {
            if(value == null) {
                return res.status(400).json({
                    error: {message: `Missing '${key}' in request body`}
                })
            }
        }
        newEvent.description = description;
        newEvent.host_id = req.user_id;

        EventService.insertEvent(
            req.app.get('db'),
            newEvent
        )
            .then(event => {
                res
                    .status(201)
                    .location(path.posix.join(req.originalUrl, `/${event.id}`))
                    .json(EventService.serializeEvent(event))
            })
            .catch(next)
    })

// cant be after '/:event_id' route
eventRouter
    .get('/sport_list', requireAuth, (req, res, next) => {
        EventService.getSportsList(req.app.get('db'))
            .then(sportsList => {
                res.json(sportsList)
            })
            .catch(next)
    })

eventRouter
    .route('/:event_id')
    .all(requireAuth)
    .all(checkEventExists)
    .get((req, res, next) => {
        res.json(EventService.serializeEvent(res.event))
    })

eventRouter
    .route('/:event_id/players')
    .all(requireAuth)
    .all(checkEventExists)
    .get((req, res, next) => {
        EventService.getPlayers(
            req.app.get('db'),
            req.params.event_id
        )
            .then(players => {
                res.json(players)
            })
            .catch(next)
    })


async function checkEventExists(req, res, next) {
    try {
        const event = await EventService.getById(
            req.app.get('db'),
            req.params.event_id
        )

        if(!event) {
            return res.status(404).json({
                error: {message: `Event doesn't exist`}
            })
        }
        event.player_id = req.user_id
        res.event = event
        next()
    } catch (error) {
        next(error)
    }
}

module.exports = eventRouter;