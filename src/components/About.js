import React from 'react'

export default function About(props) {
    let myStyle = {
        color: props.mode ==='dark'?'white':'#042743',
        backgroundColor: props.mode ==='dark'?'rgb(36 74 104)':'white', 
    }
    
    return (
        <div className="container py-5">
            <h1 className="text-center mb-5" style={{color: props.mode ==='dark'?'white':'#042743'}}>About Utextility</h1>
            
            {/* Case Conversions Section */}
            <h2 className="mb-4" style={{color: props.mode ==='dark'?'white':'#042743'}}>Case Conversions</h2>
            <div className="row g-4 mb-5">
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">UPPERCASE</h3>
                            <p className="card-text">Converts every character to capital letters. Paste your text and click 'UPPERCASE' to transform your input into all caps.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">lowercase</h3>
                            <p className="card-text">Converts every character to lowercase. Paste your text and click 'lowercase' to make all letters small.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">Capitalize Case</h3>
                            <p className="card-text">Capitalizes the first letter of each sentence. Paste your text and click 'Capitalize Case' for proper sentence formatting.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">Title Case</h3>
                            <p className="card-text">Capitalizes the first letter of every word. Paste your text and click 'Title Case' to format headings or titles.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">iNVERT cASE</h3>
                            <p className="card-text">Swaps uppercase letters for lowercase and vice versa. Paste your text and click 'iNVERT cASE' for flipped casing.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">AlTeRnAtE cAsE</h3>
                            <p className="card-text">Alternates each character between uppercase and lowercase. Paste your text and click 'AlTeRnAtE cAsE' for a playful zig-zag style.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">snake_case</h3>
                            <p className="card-text">Replaces spaces with underscores and lowercases all letters. Paste your text and click 'snake_case' for underscore_separated output.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">kebab-case</h3>
                            <p className="card-text">Replaces spaces with hyphens and lowercases all letters. Paste your text and click 'kebab-case' for dash-separated output.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">camelCase</h3>
                            <p className="card-text">Lowercases the first word and capitalizes subsequent words, removing spaces. Paste your text and click 'camelCase' for combinedWord formatting.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">PascalCase</h3>
                            <p className="card-text">Capitalizes every word and removes spaces. Paste your text and click 'PascalCase' for CombinedWord styling.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Formatting & Cleanup Section */}
            <h2 className="mb-4" style={{color: props.mode ==='dark'?'white':'#042743'}}>Formatting & Cleanup</h2>
            <div className="row g-4 mb-5">
                <div className="col-md-6 col-lg-3">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">Remove Extra Spaces</h3>
                            <p className="card-text">Collapses multiple spaces into single spaces. Paste your text and click 'Remove Extra Spaces' to normalize spacing.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-3">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">Remove Line Breaks</h3>
                            <p className="card-text">Joins all lines into one. Paste your text and click 'Remove Line Breaks' to collapse paragraph breaks.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-3">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">Remove Dashes & Underscores</h3>
                            <p className="card-text">Strips hyphens and underscores from your text. Paste your text and click 'Remove Dashes & Underscores' for cleaner output.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-3">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">Remove Punctuations</h3>
                            <p className="card-text">Deletes punctuation marks (e.g., . , ! ?). Paste your text and click 'Remove Punctuations' to leave only letters and numbers.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Miscellaneous Section */}
            <h2 className="mb-4" style={{color: props.mode ==='dark'?'white':'#042743'}}>Miscellaneous</h2>
            <div className="row g-4">
                <div className="col-md-6 col-lg-3">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">Clear Text</h3>
                            <p className="card-text">Clears the entire input area. Click 'Clear Text' to start with a blank slate.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-3">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">Copy Text</h3>
                            <p className="card-text">Copies the current text to your clipboard. Click 'Copy Text' to quickly grab your processed output.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-3">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">Reverse Words</h3>
                            <p className="card-text">Reverses the order of words. Paste your text and click 'Reverse Words' for a mirrored word sequence.</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-3">
                    <div className="card h-100" style={myStyle}>
                        <div className="card-body">
                            <h3 className="card-title text-center mb-3">Reverse All</h3>
                            <p className="card-text">Reverses every character in your input. Paste your text and click 'Reverse All' to mirror your text at the character level.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
