import {useState} from 'react';
import {client, setToken} from '../api/client.js';
import './AuthenticationPage.css';
// This is the authentication page, which handles both login and registration. It uses the client module to make API calls to the backend for authentication. The setToken function is used to store the JWT token in local storage after successful authentication. The onAuthed callback is called with the authenticated user object after successful login or registration.
export default function AuthPage({onAuthed}) {
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Handle form submission for login or registration
    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        // Depending on the mode, call the appropriate API method for login or registration
        try {
            const result = mode === 'login'
                ? await client.login(email, password)
                : await client.register(email, password, name);
            setToken(result.token);
            onAuthed(result.user);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Render the authentication form with fields for email, password, and name (if registering). The form also includes buttons to switch between login and registration modes.
    return (
        <div className="auth-page">
            
            <form onSubmit={handleSubmit} className="card">
                <h1>Apollo</h1>
                <p className="subtitle">Build a world. Let it grow.</p>
                
                <h2>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>

                {mode === 'register' && (
                    <label>
                        Name
                        <input value={name} onChange={(e) => setName(e.target.value)} required />
                    </label>
                )}
                <label>
                    Email
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
                </label>
                <label>
                    Password
                    <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
                </label>
                <button type="submit" disabled={loading}>
                    {loading ? 'Processing...' : mode === 'login' ? 'Log in' : 'Register'}
                </button>

                <button type="button"  className = "link-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                    {mode === 'login' ? 'Create an account' : 'Log in'}
                </button>

            </form>
        </div>
    );
}