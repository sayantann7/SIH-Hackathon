import { useEffect, useState } from 'react'
import trainImg from '../assets/train.png'

export default function WelcomeSplash({
	message = "Welcome to Kochi Metro Rail – Let's plan tomorrow's smooth ride together.",
	duration = 4000
}) {
	const [visible, setVisible] = useState(true)
	const [phase, setPhase] = useState('enter')

	useEffect(() => {
		const exitTimer = setTimeout(() => setPhase('exit'), duration)
		const hideTimer = setTimeout(() => setVisible(false), duration + 600)
		return () => {
			clearTimeout(exitTimer)
			clearTimeout(hideTimer)
		}
	}, [duration])

	if (!visible) return null

		return (
			<div
				className={`km-welcome ${phase === 'exit' ? 'km-welcome-exit' : ''}`}
				style={{ '--km-duration': `${duration}ms` }}
			>
				<div className="km-welcome-overlay">
					<div className="km-welcome-panel">
						<h1 className="km-welcome-title">
							{message}
						</h1>
						<p className="km-welcome-sub text-center text-steel-600 text-sm sm:text-base max-w-prose leading-relaxed">
							Preparing live fleet data and tools for an efficient schedule.
						</p>
						<div className="km-timeline" role="presentation" aria-hidden="true">
							<div className="km-timeline-track">
								<div className="km-timeline-fill" style={{ animationDuration: `${duration}ms` }} />
							</div>
							<img src={trainImg} alt="Train progress" className="km-timeline-train" style={{ '--km-duration': `${duration}ms` }} />
						</div>
					</div>
				</div>
			</div>
		)
}
