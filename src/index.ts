#!/usr/bin/env node

import {Command} from "commander"

//Declare the program
const program = new Command()

//Add actions to the program
program.action(()=>{
    console.log("Hello!")
})
.description("Greet")

//Execute the CLI with given args
program.parse(process.argv)

