import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function PageTransition({children,className}: {children:React.ReactNode;className:string}) {
    const reduced = useReducedMotion();
    return <motion.section className={className} initial={reduced ? false : {opacity:0,y:10,scale:.98}}
        animate={{opacity:1,y:0,scale:1}} transition={{duration:reduced ? 0 : .6,ease:[.25,.46,.45,.94]}}>{children}</motion.section>;
}
