import React, {useState} from 'react'


export default function TextForm(props) {
    const handleUpClick = ()=>{
        let newText = text.toUpperCase();
        setText(newText)
        props.showAlert("Converted to uppercase!", "success");
    }

    const handleLoClick = ()=>{ 
        let newText = text.toLowerCase();
        setText(newText)
        props.showAlert("Converted to lowercase!", "success");
    }

    const handleClearClick = ()=>{ 
        let newText = '';
        setText(newText);
        props.showAlert("Text Cleared!", "success");
    }

    const handleOnChange = (event)=>{
        setText(event.target.value) 
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(text); 
        props.showAlert("Copied to Clipboard!", "success");
    }

    const handleExtraSpaces = () => {
        let newText = text.split(/[ ]+/);
        setText(newText.join(" "));
        props.showAlert("Extra spaces removed!", "success");
    }

    const handleLineBreaks = () => {
        let newText = text.replace(/\n/g, " ");
        setText(newText);
        props.showAlert("Line breaks removed!", "success");
    }

    const handleCaseInversion = () => {
        let newText = "";
        for (let i = 0; i < text.length; i++) {
            let char = text[i];
            if (char === char.toUpperCase()) {
                newText += char.toLowerCase();
            } else {
                newText += char.toUpperCase();
            }
        }
        setText(newText);
        props.showAlert("Case inverted!", "success");
    }

    const handleAlternatingCase = () => {
        let newText = "";
        let shouldBeUpper = false;
        
        for (let i = 0; i < text.length; i++) {
            if (/[a-zA-Z]/.test(text[i])) {
                if (text[i] === text[i].toLowerCase()) {
                    shouldBeUpper = true;
                }
                break;
            }
        }
        
        for (let i = 0; i < text.length; i++) {
            let char = text[i];
            
            if (!/[a-zA-Z]/.test(char)) {
                newText += char;
                continue;
            }
            
            if (shouldBeUpper) {
                newText += char.toUpperCase();
            } else {
                newText += char.toLowerCase();
            }
            
            shouldBeUpper = !shouldBeUpper;
        }
        
        setText(newText);
        props.showAlert("Text converted to alternating case!", "success");
    }

    const handleCapitalizedCase = () => {
        let words = text.split(/\s+/);
        let newText = words.map(word => {
            if (word.length === 0) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(" ");
        
        setText(newText);
        props.showAlert("Text converted to capitalized case!", "success");
    }

    const handleTitleCase = () => {
        const exceptions = ["a", "an", "the", "and", "but", "for", "nor", "or", "so", "yet", 
                          "at", "by", "in", "of", "on", "to", "up", "as", "is", "if"];
        
        let words = text.split(/\s+/);
        let isStartOfSentence = true;

        let newText = words.map((word, index) => {
            if (word.length === 0) return word;
            
            if (index === 0 || isStartOfSentence) {
                isStartOfSentence = false;
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }
            
            if (exceptions.includes(word.toLowerCase())) {
                let previousWord = words[index - 1];
                if (previousWord && /[.!?]$/.test(previousWord)) {
                    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                }
                return word.toLowerCase();
            }
            
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(" ");
        
        setText(newText);
        props.showAlert("Text converted to title case!", "success");
    }

    const handleSnakeCase = () => {
        let newText = text.toLowerCase().trim();
        newText = newText.replace(/\s+/g, '_');
        newText = newText.replace(/[^\w_]/g, '_');
        newText = newText.replace(/_+/g, '_');
        
        setText(newText);
        props.showAlert("Text converted to snake_case!", "success");
    }

    const handleKebabCase = () => {
        let newText = text.toLowerCase().trim();
        newText = newText.replace(/\s+/g, '-');
        newText = newText.replace(/[^\w-]/g, '-');
        newText = newText.replace(/-+/g, '-');
        
        setText(newText);
        props.showAlert("Text converted to kebab-case!", "success");
    }

    const removeDashAndUnderscore = () => {
        let newText = text.replace(/[-_]/g, ' ');
        newText = newText.replace(/\s+/g, ' ').trim();
        setText(newText);
        props.showAlert("Dashes and underscores removed!", "success");
    }

    const handleCamelCase = () => {
        // Split into words and convert to lowercase
        let words = text.toLowerCase().split(/\s+/);
        
        // Capitalize first letter of each word except the first one
        let newText = words.map((word, index) => {
            if (index === 0) {
                return word.toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join('');
        
        setText(newText);
        props.showAlert("Text converted to camelCase!", "success");
    }

    const handlePascalCase = () => {
        // Split into words and convert to lowercase
        let words = text.toLowerCase().split(/\s+/);
        
        // Capitalize first letter of each word
        let newText = words.map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join('');
        
        setText(newText);
        props.showAlert("Text converted to PascalCase!", "success");
    }

    const [text, setText] = useState(''); 

    return (
        <>
        <div className="container" style={{color: props.mode==='dark'?'white':'#042743'}}> 
            <h1 className='mb-4'>{props.heading}</h1>
            <div className="mb-3"> 
            <textarea className="form-control" value={text} onChange={handleOnChange} style={{backgroundColor: props.mode==='dark'?'#13466e':'white', color: props.mode==='dark'?'white':'#042743'}} id="myBox" rows="8"></textarea>
            </div>
            
            <h3 className="mt-4 mb-3">Case Conversions</h3>
            <div className="mb-3">
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleUpClick}>UPPERCASE</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleLoClick}>lowercase</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleCapitalizedCase}>Capitalize Case</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleTitleCase}>Title Case</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleCaseInversion}>iNVERT cASE</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleAlternatingCase}>AlTeRnAtE cAsE</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleSnakeCase}>snake_case</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleKebabCase}>kebab-case</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleCamelCase}>camelCase</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handlePascalCase}>PascalCase</button>
            </div>

            <h3 className="mt-4 mb-3">Formatting and CleanUp</h3>
            <div className="mb-3">
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleExtraSpaces}>Remove Extra Spaces</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleLineBreaks}>Remove Line Breaks</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={removeDashAndUnderscore}>Remove Dashes & Underscores</button>
            </div>

            <h3 className="mt-4 mb-3">Miscellaneous</h3>
            <div className="mb-3">
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleClearClick}>Clear Text</button>
                <button disabled={text.length===0} className="btn btn-primary mx-1 my-1" onClick={handleCopy}>Copy Text</button>
            </div>
        </div>
        <div className="container my-3" style={{color: props.mode==='dark'?'white':'#042743'}}>
            <h2>Your text summary</h2>
            <p>Character Count: {text.length} | Word Count: {text.split(/\s+/).filter((element)=>{return element.length!==0}).length} | Sentence Count: {text.split(/[.!?]+/).filter((element)=>{return element.length!==0}).length} | Line Count: {text.split(/\n/).filter((element)=>{return element.length!==0}).length}</p>
            <p>{(0.008 * text.split(/\s+/).filter((element)=>{return element.length!==0}).length).toFixed(3)} Minutes read</p>
            <h2>Preview</h2>
            <p>{text.length>0?text:"Nothing to preview!"}</p>
        </div>
        </>
    )
}
