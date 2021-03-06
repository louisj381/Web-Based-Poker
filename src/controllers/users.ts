import { Request, Response, NextFunction } from 'express'
import { User, } from '../entities'


export async function login(req: Request, res: Response, next: NextFunction) {
    let user = await User.createQueryBuilder('user')
        .where("user.username = :username AND user.password = :password",{
            username: req.body.username,
            password: req.body.password
        })
        .getOne()
    
    if(user){
        res.json({
            message: 'found',
            user: user
        })
    }else{
        res.json('not-found')
    }

}
export async function signUp(req: Request, res: Response, next: NextFunction) {
    try{
        let ID = '_' + Math.random().toString(36).substr(2, 9);
        let users = await User.find()
        console.log(ID)
        let user = new User()
        user.id = ID
        user.username = req.body.username
        user.email = req.body.email
        user.password = req.body.password
        user.wins = 0
        if(users.length === 0){
            user.isAdmin = true
        }else{
            user.isAdmin = false
        }
        await user.save()
        res.json(user)
    }
    catch(err){
        res.json({message: 'already exsists'})
    }


// let users = await User.query("DROP TABLE[user]")
// console.log(users)

}
export async function getUser(req: Request, res: Response, next: NextFunction) {
    try{
        let user = await User.findOneOrFail(req.body.id)
        console.log(user)
        res.json({
            user: user
        })
    }
    catch(err){
        res.json('fail')
    }
}
export async function getAllUsers(req: Request, res: Response, next: NextFunction) {
    let users = await User.find()
    res.json({
        users: users
    })


}
export async function makeAdmin(req: Request, res: Response, next: NextFunction) {
    let user = await User.createQueryBuilder('user')
    .where("user.username = :username",{
        username: req.body.username,
    })
    .getOne()

    if(user){
        user.isAdmin = true
        user.save()
        res.json({
            success: 'success'
        })
    }else{
        res.json('not-found')
    }

}
export async function makeStandard(req: Request, res: Response, next: NextFunction) {
    let user = await User.createQueryBuilder('user')
    .where("user.username = :username",{
        username: req.body.username,
    })
    .getOne()

    if(user){
        user.isAdmin = false
        user.save()
        res.json({
            success: 'success'
        })
    }else{
        res.json('not-found')
    }

}
export async function deleteUser(req: Request, res: Response, next: NextFunction) {
    try{
        await User.createQueryBuilder('user').delete()
        .where("user.username = :username",{
            username: req.body.username,
        }).execute()
        res.json({
            success: 'success'
        })
    }
    catch(err){
        res.json({
            fail: 'fail'
        })
    }
}
export async function updateUser(req: Request, res: Response, next: NextFunction) {
    let user = await User.findOneOrFail(req.body.id)
    if(req.body.password && user.password !== req.body.password){
        res.json('incorrect password')
    }else if( req.body.newPassword !== req.body.confirmNewPassword){
        res.json('passwords do not match')
    }else{
        user.username = req.body.username
        if(req.body.newPassword !== ''){
            user.password = req.body.newPassword
        }
        if(req.body.email){
            user.email = req.body.email
        }
        user.save()
        res.json({
            message: 'success',
            user: user
        })
    }
}