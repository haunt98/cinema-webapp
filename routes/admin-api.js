const express = require("express");
const bcrypt = require('bcrypt')
const router = express.Router();

const jwt = require('jsonwebtoken')
const secretKey = process.env.SECRET_KEY || 'wtf'
const tokenName = 'NIGAMON_JWT_TOKEN'

const LIMIT = 5;

const {
    Op,
    Admin,
    User,
    Movie,
    MovieGenre,
    Theater,
    TheaterStatus,
    TicketType,
    TicketStatus,
    ShowTime,
    Ticket,
    TicketShoppingCart,
    Order,
    OrderStatus,
    OrdererTicket,
    Food,
    FoodStatus,
    FoodOrder,
    FoodShoppingCart,
    Banner
} = require("../models");

//---------------------------------- jwt middleware ------------------------------------//
const adminJwtMiddleware = (req, res, next) => {
    if (req.headers.authorization) {
        jwt.verify(req.headers.authorization.slice(7), secretKey, (err, decoded) => {
            if (err) {
                res.status(401).send('Unauthorized Access')
            } else {
                jwt.sign({
                    name: decoded.name,
                    lastLogin: decoded.lastLogin,
                    email: decoded.email
                }, secretKey, {
                        expiresIn: "2h"
                    }, (err, token) => {
                        if (err) {
                            res.status(500).send('Something is broken')
                        } else {
                            res.set(tokenName, token)
                            res.status(200)
                            next()
                        }
                    })
            }
        })
    } else {
        res.status(401).send('Unauthorized Access')
    }
}

//---------------------------------------- login -----------------------------------------------//
router.post('/login', (req, res) => {
    Admin.findByPk(req.body.email)
        .then(data => {
            bcrypt.compare(req.body.password, data.hashedPassword, (err, bcryptRes) => {
                if (err) {
                    return res.json({ isLogin: false })
                }
                Admin.update({
                    lastLogin: new Date()
                }, {
                        where: {
                            email: data.email
                        }
                    })
                jwt.sign({
                    name: data.adminName,
                    lastLogin: data.lastLogin,
                    email: data.email
                }, secretKey, {
                        expiresIn: "2h"
                    }, (err, token) => {
                        if (err) {
                            res.status(500).send('Something is broken')
                        } else {
                            res.json({
                                isLogin: true,
                                token: token,
                                userInfo: {
                                    name: data.adminName,
                                    lastLogin: data.lastLogin,
                                    email: data.email
                                }
                            })
                        }
                    })
            })
        })
        .catch(() => res.json({ isLogin: false }))
})

router.get('/login', adminJwtMiddleware, (req, res) => {
    const decoded = jwt.decode(req.headers.authorization.slice(7))
    res.json({
        isLogin: true,
        userInfo: {
            name: decoded.name,
            lastLogin: decoded.lastLogin,
            email: decoded.email
        }
    })
})

//----------------------------------- dashboard-------------------------------------//
router.get('/dashboard/orders', adminJwtMiddleware, (req, res) => {
    console.log('orders dashboard')
    const query = req.query
    const page = parseInt(query.page || 0)
    const status = parseInt(query.status || 0)

    Order.findAndCountAll({
        where: {
            ...(status ? { orderStatusId: status } : {}),
        },
        limit: LIMIT,
        offset: (page - 1) * LIMIT,
        order: [['updatedAt', 'DESC']],
    }).then(result => Promise.all(result.rows.map(r => r.dataValues).map(async r => {
        const user = await User.findByPk(r.userId)
        const tickets = await OrdererTicket.findAndCountAll({
            where: { orderId: r.id }
        }).then(result => {
            return Promise.all(result.rows.map(r => r.dataValues)
                .map(async r => {
                    const ticket = await Ticket.findByPk(r.ticketId)
                    const showTime = await ShowTime.findByPk(ticket.showTimeId)
                    const ticketType = await TicketType.findByPk(showTime.ticketTypeId)
                    return {
                        price: ticketType.price
                    }
                })
            )
        })
        const foods = await FoodOrder.findAndCountAll({
            where: { orderId: r.id }
        }).then(result => {
            return Promise.all(result.rows.map(r => r.dataValues)
                .map(async r => {
                    const food = await Food.findByPk(r.foodId)
                    return {
                        price: food.price * r.quantity
                    }
                }))
        })
        const total = tickets.reduce((p, c) => p + c.price, 0)
            + foods.reduce((p, c) => p + c.price, 0)
        return {
            username: user.username,
            date: r.createdAt,
            time: r.createdAt,
            total: total
        }
    })).then(data => {
        let orders = data
        res.json({
            orders: orders,
            currentPage: page,
            lastPage: Math.ceil(result.count / LIMIT),
            total: result.count
        })
    })).catch(err => {
        console.log(err)
        res.status(500).send('GET Dashboard Orders Error')
    })
})
router.get('/dashboard/movies', adminJwtMiddleware, (req, res) => {
    console.log('movies dashboard')
    const query = req.query
    const page = parseInt(query.page || 1)
    const today = new Date()
    let endOfDate = new Date()
    endOfDate.setHours(23, 59, 59)
    let startOfDate = new Date()
    startOfDate.setHours(0, 0, 0)

    ShowTime.findAndCountAll({
        where: {
            date: {
                [Op.lte]: endOfDate,
                [Op.gte]: startOfDate
            },
            time: {
                [Op.lte]: `${today.getHours()}:${today.getSeconds()}`
            },
        },
        order: [['time', 'DESC']]
    }).then(results => {
        Promise.all(results.rows.map(r => r.dataValues).map(async r => {
            let movie = await Movie.findByPk(r.movieId)
            let theater = await Theater.findByPk(r.theaterId)
            let genre = await MovieGenre.findByPk(movie.movieGenreId)

            let movieStart = r.time.split(':').map(c => parseInt(c))
            movieStart = movieStart[0] * 60 + movieStart[1]
            let currentTime = today.getHours() * 60 + today.getMinutes()
            if (movieStart + 120 > currentTime) {
                return {
                    name: movie.name,
                    type: genre.name,
                    director: movie.director,
                    theater: theater.name,
                    showTime: r.time
                }
            }
            return null
        })).then(data => {
            const movies = data.filter(m => m !== null)
            res.json({
                movies: movies.slice((page - 1) * LIMIT, page * LIMIT),
                currentPage: page,
                lastPage: Math.ceil(movies.length / LIMIT),
                total: movies.length
            })
        })
    }).catch(err => {
        console.log(err)
        res.status(500).send('GET Dashboard Movies Error')
    })
})
router.get('/dashboard/theaters', adminJwtMiddleware, (req, res) => {
    console.log('theaters dashboard')
    const query = req.query
    const page = parseInt(query.page || 0)
    const today = new Date()
    let endOfDate = new Date()
    endOfDate.setHours(23, 59, 59)
    let startOfDate = new Date()
    startOfDate.setHours(0, 0, 0)

    Theater.findAndCountAll({
        where: {
            theaterStatusId: 1,
        },
        ...(page ? ({
            limit: LIMIT,
            offset: LIMIT * (page - 1),
            order: [['updatedAt', 'DESC']],
        }) : {})
    }).then(results => {
        Promise.all(results.rows.map(r => r.dataValues).map(async r => {
            return await ShowTime.findAndCountAll({
                where: {
                    theaterId: r.id,
                    date: {
                        [Op.lte]: endOfDate,
                        [Op.gte]: startOfDate
                    },
                    time: {
                        [Op.gte]: `${today.getHours()}:${today.getSeconds()}`
                    }
                },
                limit: 1,
                order: [['time', 'ASC']]
            }).then(results => {
                if (results.count === 0) {
                    return null
                }
                const showtime = results.rows[0].dataValues
                return OrdererTicket.findAndCountAll({
                    include: [{
                        model: Ticket,
                        as: 'ticket'
                    }],
                    where: {
                        "$ticket.showTimeId$": showtime.id
                    }
                }).then(results => results.count)
                    .then(count => {
                        return {
                            name: r.name,
                            address: r.address,
                            capacity: r.rowNum * r.seatPerRow,
                            ordered: count
                        }
                    })
            })
        })).then(theaters => {
            res.json({
                theaters: theaters.filter(t => t !== null),
                currentPage: page,
                lastPage: Math.ceil(results.count / LIMIT),
                total: results.count
            })
        })
    }).catch(err => {
        console.log(err)
        res.status(500).send('GET Dashboard Theaters Error')
    })
})
router.get('/dashboard/charts', adminJwtMiddleware, (req, res) => {
    console.log('charts dashboard')
    const query = req.query
    let start = query.start && new Date(query.start)
    if (start) {
        start.setHours(0, 0, 0)
    }
    let end = query.end && new Date(query.end)
    if (end) {
        end.setHours(23, 59, 59)
    }

    Order.findAndCountAll({
        where: {
            orderStatusId: 1,
            ...((start || end) ? ({
                createdAt: {
                    ...(start ? ({
                        [Op.gte]: start
                    }) : {}),
                    ...(end ? ({
                        [Op.lte]: end
                    }) : {})
                }
            }) : {})
        },
        order: [['createdAt', 'ASC']],
    }).then(result => {
        if (!start) {
            start = new Date(result.rows[0].dataValues.createdAt)
        }
        if (!end) {
            end = new Date(result.rows[result.rows.length - 1].dataValues.createdAt)
        }
        let labels = []
        let date = new Date(start.getTime())
        while (date.getDate() < end.getDate() || date.getMonth() < end.getMonth() || date.getFullYear() < end.getFullYear()) {
            labels.push(new Date(date.getTime()))
            let currentDate = date.getDate()
            date.setDate(currentDate + 1)
        }
        labels.push(end)

        Promise.all(labels.map(async d => {
            let startOfDate = new Date(d.getTime())
            startOfDate.setHours(0, 0, 0)
            let endOfDate = new Date(d.getTime())
            endOfDate.setHours(23, 59, 59)

            const orders = await Order.findAndCountAll({
                where: {
                    createdAt: {
                        [Op.gte]: startOfDate,
                        [Op.lte]: endOfDate
                    }
                }
            }).then(result => Promise.all(result.rows.map(r => r.dataValues).map(async r => {
                const tickets = await OrdererTicket.findAndCountAll({
                    where: { orderId: r.id }
                }).then(result => {
                    return Promise.all(result.rows.map(r => r.dataValues)
                        .map(async r => {
                            const ticket = await Ticket.findByPk(r.ticketId)
                            const showTime = await ShowTime.findByPk(ticket.showTimeId)
                            const ticketType = await TicketType.findByPk(showTime.ticketTypeId)
                            return {
                                price: ticketType.price
                            }
                        })
                    )
                })
                const foods = await FoodOrder.findAndCountAll({
                    where: { orderId: r.id }
                }).then(result => {
                    return Promise.all(result.rows.map(r => r.dataValues)
                        .map(async r => {
                            const food = await Food.findByPk(r.foodId)
                            return {
                                price: food.price * r.quantity
                            }
                        }))
                })
                const ticketTotal = tickets.reduce((p, c) => p + c.price, 0)
                const foodTotal = foods.reduce((p, c) => p + c.price, 0)
                return {
                    food: foodTotal,
                    ticket: ticketTotal,
                    total: ticketTotal + foodTotal
                }
            })))
            const users = await User.findAndCountAll({
                where: {
                    createdAt: {
                        [Op.gte]: startOfDate,
                        [Op.lte]: endOfDate
                    }
                }
            }).then(result => result.rows.length)
            return {
                date: d,
                orders: orders,
                users: users
            }
        })).then(data => {
            const totalFood = data.map(d => d.orders.reduce((p, c) => p + c.food, 0)).reduce((p, c) => p + c, 0)
            const totalTicket = data.map(d => d.orders.reduce((p, c) => p + c.ticket, 0)).reduce((p, c) => p + c, 0)
            const total = totalFood + totalTicket
            res.json({
                charts: {
                    income: {
                        labels: labels,
                        data: data.map(d => d.orders.reduce((p, c) => p + c.total, 0))
                    },
                    newUser: {
                        labels: labels,
                        data: data.map(d => {
                            return d.users
                        })
                    },
                    incomeShare: {
                        labels: ['Thuc an', 'Ve phim'],
                        data: [totalFood * 100 / total, totalTicket * 100 / total]
                    }
                }
            })
        })
    }).catch(err => {
        console.log(err)
        res.status(500).send('GET Dashboard Charts Error')
    })
})

//------------------------------------ theaters ---------------------------------------------//
router.get('/theaters/status', adminJwtMiddleware, (req, res) => {
    TheaterStatus.findAndCountAll({
    }).then(result => {
        const status = (result.rows.map(r => r.dataValues).map(r => ({
            id: r.id,
            label: r.name
        })))
        res.json({
            choices: status
        })
    }).catch(err => {
        res.status(500).send('GET Theater Status Error')
    })
})
router.get('/theaters/:theaterid/showtimes', adminJwtMiddleware, (req, res) => {
    const theater = parseInt(req.params.theaterid)
    const date = req.query.date
    let endOfDate = new Date(date)
    endOfDate.setHours(23, 59, 59)
    let startOfDate = new Date(date)
    startOfDate.setHours(0, 0, 0)
    ShowTime.findAndCountAll({
        where: {
            theaterId: theater,
            date: {
                [Op.lte]: endOfDate,
                [Op.gte]: startOfDate
            }
        }
    }).then(result => {
        Promise.all(result.rows.map(r => r.dataValues).map(async r => {
            return await Ticket.findAndCountAll({
                where: {
                    showTimeId: r.id,
                }
            }).then(result => {
                if (result.rows) {
                    return Promise.all(result.rows.map(r => r.dataValues).map(async r => {
                        try {
                            const ticket = await OrdererTicket.findByPk(r.id)
                            if (ticket.id) {
                                return [r.seatRow, r.seatColumn]
                            }
                            return null
                        } catch (err) {
                            return null
                        }
                    })).then(tickets => tickets.filter(t => t !== null))
                }
                return []
            }).then(ordered => {
                return {
                    id: r.id,
                    time: r.time,
                    movie: r.movieId,
                    ticket: r.ticketTypeId,
                    ordered: ordered
                }
            })
        })).then(data => {
            res.json({
                showTimes: data
            })
        })
    }).catch(err => {
        res.status(500).send('GET Theater Showtimes Error')
    })
})
router.post('/theaters/:theaterid/showtimes', adminJwtMiddleware, (req, res) => {
    const add = req.query.addNew || false
    const theaterid = parseInt(req.params.theaterid)
    const showtime = req.body
    const date = req.query.date
    let endOfDate = new Date(date)
    endOfDate.setHours(23, 59, 59)
    let startOfDate = new Date(date)
    startOfDate.setHours(0, 0, 0)

    if (add) {
        ShowTime.create({
            time: showtime.time,
            date: date,
            movieId: showtime.movie,
            theaterId: theaterid,
            ticketTypeId: showtime.ticket
        }).then(() => {
            res.json({ code: 'OK' })
        }).catch(err => {
            console.log(err)
            res.json({
                code: 'FAILED',
                msg: err
            })
        })
    } else {
        ShowTime.update({
            time: showtime.time,
            movieId: showtime.movie,
            ticketTypeId: showtime.ticket
        }, {
                where: {
                    id: showtime.id,
                    theaterId: theaterid
                }
            }).then(() => {
                res.json({
                    code: 'OK'
                })
            }).catch(err => {
                console.log(err)
                res.json({
                    code: 'FAILED',
                    msg: err
                })
            })
    }
})
router.delete('/theaters/:theaterid/showtimes/:showtimeid', adminJwtMiddleware, (req, res) => {
    const theaterid = parseInt(req.params.theaterid)
    const showtimeid = parseInt(req.params.showtimeid)
    ShowTime.destroy({
        where: {
            id: showtimeid,
            theaterId: theaterid
        }
    }).then(() => {
        res.json({
            code: 'OK'
        })
    }).catch(err => {
        console.log(err)
        res.json({
            code: 'FAILED',
            msg: err
        })
    })
})
router.get('/theaters', adminJwtMiddleware, (req, res) => {
    console.log('theaters')
    const query = req.query
    const page = parseInt(query.page || 0)
    const status = parseInt(query.status || 0)
    const searchText = query.searchText

    Theater.findAndCountAll({
        where: {
            ...(status ? { theaterStatusId: status } : {})
        },
        ...(page ? ({
            limit: LIMIT,
            offset: LIMIT * (page - 1),
            order: [['updatedAt', 'DESC']],
        }) : {})
    }).then(result => {
        const theaters = (result.rows.map(r => r.dataValues).map(r => ({
            id: r.id,
            name: r.name,
            address: r.address,
            row: r.rowNum,
            column: r.seatPerRow,
            status: r.theaterStatusId
        })))
        res.json({
            theaters: theaters,
            currentPage: page,
            lastPage: Math.ceil(result.count / LIMIT),
            total: result.count
        })
    }).catch(err => {
        res.status(500).send('GET Theaters Error')
    })
})
router.post('/theaters/:id', adminJwtMiddleware, (req, res) => {
    const add = req.query.addNew || false
    const theater = req.body
    if (parseInt(req.params.id) !== parseInt(theater.id)) {
        return res.json({
            code: 'FAILED',
            msg: 'Mismatch ID'
        })
    }
    if (add) {
        Theater.create({
            id: theater.id,
            name: theater.name,
            address: theater.address,
            rowNum: theater.row,
            seatPerRow: theater.column,
            theaterStatusId: theater.status
        }).then(() => {
            res.json({ code: 'OK' })
        }).catch(err => {
            console.log(err)
            res.json({
                code: 'FAILED',
                msg: err
            })
        })
    } else {
        Theater.update({
            name: theater.name,
            address: theater.address,
            rowNum: theater.row,
            seatPerRow: theater.column,
            theaterStatusId: theater.status
        }, {
                where: {
                    id: theater.id
                }
            }).then(() => {
                res.json({
                    code: 'OK'
                })
            }).catch(err => {
                console.log(err)
                res.json({
                    code: 'FAILED',
                    msg: err
                })
            })
    }
})
router.delete('/theaters/:id', adminJwtMiddleware, (req, res) => {
    Theater.destroy({
        where: {
            id: parseInt(req.params.id)
        }
    }).then(() => {
        res.json({
            code: 'OK'
        })
    }).catch(err => {
        console.log(err)
        res.json({
            code: 'FAILED',
            msg: err
        })
    })
})

//---------------------------------------- movies --------------------------------------------//
router.get('/movies/genres', adminJwtMiddleware, (req, res) => {
    MovieGenre.findAndCountAll({
    }).then(result => {
        const types = (result.rows.map(r => r.dataValues).map(r => ({
            id: r.id,
            label: r.name,
        })))
        res.json({
            choices: types
        })
    }).catch(err => {
        res.status(500).send('GET Movie Genres Error')
    })
})
router.get('/movies', adminJwtMiddleware, (req, res) => {
    console.log('movies')
    const query = req.query
    const page = parseInt(query.page || 0)
    const genre = parseInt(query.genre || '0')
    const status = query.status
    const searchText = query.searchText

    const getStatusWhere = (status) => {
        switch (status) {
            case 'coming': {
                return {
                    startDate: { [Op.gt]: new Date() },
                }
            }
            case 'showing': {
                return {
                    startDate: {
                        [Op.or]: [
                            { [Op.eq]: null },
                            { [Op.lte]: new Date() }
                        ]
                    },
                    endDate: {
                        [Op.or]: [
                            { [Op.eq]: null },
                            { [Op.gte]: new Date() }
                        ]
                    }
                }
            }
            case 'passed': {
                return {
                    endDate: { [Op.lt]: new Date() },
                }
            }
            default: {
                return {}
            }
        }
    }

    Movie.findAndCountAll({
        where: {
            ...(genre ? { movieGenreId: genre } : {}),
            ...getStatusWhere(status)
        },
        ...(page ? ({
            limit: LIMIT,
            offset: LIMIT * (page - 1),
            order: [['updatedAt', 'DESC']],
        }) : {})
    }).then(result => {
        const movies = (result.rows.map(r => r.dataValues).map(r => ({
            id: r.id,
            name: r.name,
            actor: r.actor,
            director: r.director,
            type: r.movieGenreId,
            length: 180,
            start: r.startDate,
            end: r.endDate,
            intro: r.introduce,
            imageUrl: r.photoUrl
        })))
        res.json({
            movies: movies,
            currentPage: page,
            lastPage: Math.ceil(result.count / LIMIT),
            total: result.count
        })
    }).catch(err => {
        res.status(500).send('GET Movies Error')
    })
})
router.post('/movies/:id', adminJwtMiddleware, (req, res) => {
    const add = req.query.addNew || false
    const movie = req.body
    if (parseInt(req.params.id) !== parseInt(movie.id)) {
        return res.json({
            code: 'FAILED',
            msg: 'Mismatch ID'
        })
    }
    if (add) {
        Movie.create({
            id: movie.id,
            name: movie.name,
            actor: movie.actor,
            director: movie.director,
            startDate: movie.start && new Date(movie.start),
            endDate: movie.end && new Date(movie.end),
            introduce: movie.intro,
            imageUrl: movie.imageUrl,
            movieGenreId: movie.type
        }).then(() => {
            res.json({ code: 'OK' })
        }).catch(err => {
            console.log(err)
            res.json({
                code: 'FAILED',
                msg: err
            })
        })
    } else {
        Movie.update({
            name: movie.name,
            actor: movie.actor,
            director: movie.director,
            startDate: movie.start && new Date(movie.start),
            endDate: movie.end && new Date(movie.end),
            introduce: movie.intro,
            imageUrl: movie.imageUrl,
            movieGenreId: movie.type
        }, {
                where: {
                    id: movie.id
                }
            }).then(() => {
                res.json({
                    code: 'OK'
                })
            }).catch(err => {
                console.log(err)
                res.json({
                    code: 'FAILED',
                    msg: err
                })
            })
    }
})
router.delete('/movies/:id', adminJwtMiddleware, (req, res) => {
    Movie.destroy({
        where: {
            id: parseInt(req.params.id)
        }
    }).then(() => {
        res.json({
            code: 'OK'
        })
    }).catch(err => {
        console.log(err)
        res.json({
            code: 'FAILED',
            msg: err
        })
    })
})

//------------------------------------------- tickets -------------------------------------//
router.get('/tickets/status', adminJwtMiddleware, (req, res) => {
    TicketStatus.findAndCountAll({
    }).then(result => {
        const types = (result.rows.map(r => r.dataValues).map(r => ({
            id: r.id,
            label: r.name,
        })))
        res.json({
            choices: types
        })
    }).catch(err => {
        res.status(500).send('GET Ticket Status Error')
    })
})
router.get('/tickets', adminJwtMiddleware, (req, res) => {
    console.log('tickets')
    const query = req.query
    const page = parseInt(query.page || 0)
    const status = parseInt(query.status || 0)
    const searchText = query.searchText

    TicketType.findAndCountAll({
        where: {
            ...(status ? { ticketStatusId: status } : {})
        },
        ...(page ? ({
            limit: LIMIT,
            offset: LIMIT * (page - 1),
            order: [['updatedAt', 'DESC']],
        }) : {})
    }).then(result => {
        const tickets = (result.rows.map(r => r.dataValues).map(r => ({
            id: r.id,
            name: r.name,
            price: r.price,
            status: r.ticketStatusId
        })))
        res.json({
            tickets: tickets,
            currentPage: page,
            lastPage: Math.ceil(result.count / LIMIT),
            total: result.count
        })
    }).catch(err => {
        res.status(500).send('GET Tickets Error')
    })
})
router.post('/tickets/:id', adminJwtMiddleware, (req, res) => {
    const add = req.query.addNew || false
    const ticket = req.body
    if (parseInt(req.params.id) !== parseInt(ticket.id)) {
        return res.json({
            code: 'FAILED',
            msg: 'Mismatch ID'
        })
    }
    if (add) {
        TicketType.create({
            id: ticket.id,
            name: ticket.name,
            price: ticket.price,
            ticketStatusId: ticket.status
        }).then(() => {
            res.json({ code: 'OK' })
        }).catch(err => {
            console.log(err)
            res.json({
                code: 'FAILED',
                msg: err
            })
        })
    } else {
        TicketType.update({
            name: ticket.name,
            price: ticket.price,
            ticketStatusId: ticket.status
        }, {
                where: {
                    id: ticket.id
                }
            }).then(() => {
                res.json({
                    code: 'OK'
                })
            }).catch(err => {
                console.log(err)
                res.json({
                    code: 'FAILED',
                    msg: err
                })
            })
    }
})
router.delete('/tickets/:id', adminJwtMiddleware, (req, res) => {
    TicketType.destroy({
        where: {
            id: parseInt(req.params.id)
        }
    }).then(() => {
        res.json({
            code: 'OK'
        })
    }).catch(err => {
        console.log(err)
        res.json({
            code: 'FAILED',
            msg: err
        })
    })
})

//----------------------------------------- foods ---------------------------------------------//
router.get('/foods/status', adminJwtMiddleware, (req, res) => {
    console.log('food status')
    FoodStatus.findAndCountAll({
    }).then(result => {
        const types = (result.rows.map(r => r.dataValues).map(r => ({
            id: r.id,
            label: r.name,
        })))
        res.json({
            choices: types
        })
    }).catch(err => {
        res.status(500).send('GET Food Status Error')
    })
})
router.get('/foods', adminJwtMiddleware, (req, res) => {
    console.log('foods')
    const query = req.query
    const page = parseInt(query.page || 0)
    const status = parseInt(query.status || 0)
    const searchText = query.searchText

    Food.findAndCountAll({
        where: {
            ...(status ? { foodStatusId: status } : {})
        },
        ...(page ? ({
            limit: LIMIT,
            offset: LIMIT * (page - 1),
            order: [['updatedAt', 'DESC']],
        }) : {})
    }).then(result => {
        const foods = (result.rows.map(r => r.dataValues).map(r => ({
            id: r.id,
            name: r.name,
            price: r.price,
            status: r.foodStatusId
        })))
        res.json({
            foods: foods,
            currentPage: page,
            lastPage: Math.ceil(result.count / LIMIT),
            total: result.count
        })
    }).catch(err => {
        res.status(500).send('GET Tickets Error')
    })
})
router.post('/foods/:id', adminJwtMiddleware, (req, res) => {
    const add = req.query.addNew || false
    const food = req.body

    if (parseInt(req.params.id) !== parseInt(food.id)) {
        return res.json({
            code: 'FAILED',
            msg: 'Mismatch ID'
        })
    }

    if (add) {
        Food.create({
            id: food.id,
            name: food.name,
            price: food.price,
            foodStatusId: food.status
        }).then(() => {
            res.json({ code: 'OK' })
        }).catch(err => {
            console.log(err)
            res.json({
                code: 'FAILED',
                msg: err
            })
        })
    } else {
        Food.update({
            name: food.name,
            price: food.price,
            foodStatusId: food.status
        }, {
                where: {
                    id: food.id
                }
            }).then(() => {
                res.json({
                    code: 'OK'
                })
            }).catch(err => {
                console.log(err)
                res.json({
                    code: 'FAILED',
                    msg: err
                })
            })
    }
})
router.delete('/foods/:id', adminJwtMiddleware, (req, res) => {
    Food.destroy({
        where: {
            id: parseInt(req.params.id)
        }
    }).then(() => {
        res.json({
            code: 'OK'
        })
    }).catch(err => {
        console.log(err)
        res.json({
            code: 'FAILED',
            msg: err
        })
    })
})

//---------------------------------------- orders --------------------------------//
router.get('/orders/status', adminJwtMiddleware, (req, res) => {
    console.log('order status')
    OrderStatus.findAndCountAll({
    }).then(result => {
        const types = (result.rows.map(r => r.dataValues).map(r => ({
            id: r.id,
            label: r.name,
        })))
        res.json({
            choices: types
        })
    }).catch(err => {
        res.status(500).send('GET Order Status Error')
    })
})
router.get('/orders', adminJwtMiddleware, (req, res) => {
    console.log('orders')
    const query = req.query
    const page = parseInt(query.page || 0)
    const status = parseInt(query.status || 0)
    let dateStart = query.dateStart && new Date(query.dateStart)
    if (dateStart) {
        dateStart.setHours(0, 0, 0)
    }
    let dateEnd = query.dateEnd && new Date(query.dateEnd)
    if (dateEnd) {
        dateEnd.setHours(23, 59, 59)
    }
    const moneyStart = query.moneyStart && parseInt(query.moneyStart)
    const moneyEnd = query.moneyEnd && parseInt(query.moneyEnd)
    const searchText = query.searchText

    Order.findAndCountAll({
        where: {
            ...(status ? { orderStatusId: status } : {}),
            ...(dateStart ? ({
                createdAt: {
                    [Op.gte]: dateStart
                }
            }) : {}),
            ...(dateEnd ? ({
                createdAt: {
                    [Op.lte]: dateEnd
                }
            }) : {}),
        },
        order: [['updatedAt', 'DESC']],
    }).then(result => result.rows.map(r => r.dataValues))
        .then(rows => {
            return Promise.all(rows.map(async r => {
                const user = await User.findByPk(r.userId)
                const tickets = await OrdererTicket.findAndCountAll({
                    where: { orderId: r.id }
                }).then(result => {
                    return Promise.all(result.rows.map(r => r.dataValues)
                        .map(async r => {
                            const ticket = await Ticket.findByPk(r.ticketId)
                            const showTime = await ShowTime.findByPk(ticket.showTimeId)
                            const ticketType = await TicketType.findByPk(showTime.ticketTypeId)
                            return {
                                theater: showTime.theaterId,
                                date: showTime.date,
                                time: showTime.time,
                                row: ticket.seatRow,
                                column: ticket.seatColumn,
                                ticket: showTime.ticketTypeId,
                                price: ticketType.price
                            }
                        })
                    )
                })
                const foods = await FoodOrder.findAndCountAll({
                    where: { orderId: r.id }
                }).then(result => {
                    return Promise.all(result.rows.map(r => r.dataValues)
                        .map(async r => {
                            const food = await Food.findByPk(r.foodId)
                            return {
                                id: r.foodId,
                                quantity: r.quantity,
                                price: food.price * r.quantity
                            }
                        }))
                })
                const total = tickets.reduce((p, c) => p + c.price, 0)
                    + foods.reduce((p, c) => p + c.price, 0)
                return {
                    id: r.id,
                    username: user.username,
                    datetime: r.createdAt,
                    tickets: tickets,
                    foods: foods,
                    status: r.orderStatusId,
                    total: total
                }
            })).then(data => {
                let orders = data
                if (moneyStart) {
                    orders = orders.filter(o => o.total >= moneyStart)
                }
                if (moneyEnd) {
                    orders = orders.filter(o => o.total <= moneyEnd)
                }
                res.json({
                    orders: orders.slice((page - 1) * LIMIT, page * LIMIT),
                    currentPage: page,
                    lastPage: Math.ceil(orders.length / LIMIT),
                    total: orders.length
                })
            })
        }).catch(err => {
            console.log(err)
            res.status(500).send('GET Orders Error')
        })
})
router.post('/orders/:id', adminJwtMiddleware, (req, res) => {
    const add = req.query.addNew || false
    const order = req.body
    if (parseInt(req.params.id) !== parseInt(order.id)) {
        return res.json({
            code: 'FAILED',
            msg: 'Mismatch ID'
        })
    }

    User.findOne({ where: { username: order.username } })
        .then(user => {
            if (add) {
                Order.create({
                    id: order.id,
                    orderStatusId: order.status,
                    userId: user.id
                }).then(() => {
                    res.json({ code: 'OK' })
                }).catch(err => {
                    res.json({
                        code: 'FAILED',
                        msg: err
                    })
                })
            } else {
                Order.update({
                    orderStatusId: order.status,
                    userId: user.id
                }, {
                        where: {
                            id: order.id
                        }
                    }).then(() => {
                        res.json({ code: 'OK' })
                    }).catch(err => {
                        res.json({
                            code: 'FAILED',
                            msg: err
                        })
                    })
            }
        })
        .catch(err => {
            console.log(err)
            return res.json({
                code: 'FAILED',
                msg: err
            })
        })
})

module.exports = router;
